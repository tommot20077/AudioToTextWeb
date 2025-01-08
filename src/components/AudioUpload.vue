<template>
    <div class="upload-container" :class="{'has-result': downloadUrl || segments.length}">
        <div class="form-section">
            <h1>音檔轉錄</h1>
            <form @submit.prevent="handleSubmit">
                <div class="form-group">
                    <label for="file">選擇音檔：</label>
                    <input type="file" id="file" @change="handleFileChange" required/>
                </div>
                <div class="form-group">
                    <label for="model">模型類型：</label>
                    <select id="model" v-model="modelType" required>
                        <option v-for="model in models" :key="model.code" :value="model.code">
                            {{ model.description }}
                        </option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="format">格式類型：</label>
                    <select id="format" v-model="formatType" required>
                        <option v-for="type in outputType" :key="type" :value="type">
                            {{ type }}
                        </option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="segment">需要分段：</label>
                    <label class="switch">
                        <input type="checkbox" id="segment" v-model="isNeedSegment"/>
                        <span class="slider round"></span>
                    </label>
                </div>
                <button type="submit" :disabled="isLoading || progressing">
                    {{ isLoading || progressing ? '轉錄中...' : '上傳並轉錄' }}
                </button>
                <div v-if="errorMessage" class="error-message">
                    {{ errorMessage }}
                </div>
            </form>

            <div v-if="isLoading" class="loading-overlay">
                <div class="spinner"></div>
            </div>

            <div v-if="progress !== null" class="progress-container">
                <h2>轉錄進度：</h2>
                <progress :value="animatedProgress" max="100"></progress>
                <span>{{ animatedProgress.toFixed(2) }}%</span>
            </div>
        </div>

        <div class="result-section" v-if="downloadUrl || segments.length">
            <div class="result">
                <div class="download-center">
                    <h1>轉錄完成！</h1>
                    <a :href="downloadUrl" target="_blank" class="download-link">下載檔案</a>
                </div>
                <div class="result-content">
                    <div class="full-text-container">
                        <h3>完整句子：</h3>
                        <p class="segment-item">{{ fullText }}</p>
                    </div>
                    <div class="segments-container" v-if="isNeedSegment">
                        <h3>分段句子：</h3>
                        <ul>
                            <li v-for="segment in segments" :key="segment.start_time" class="segment-item">
                                <div style="text-align: center;">
                                    {{ formatTime(segment.start_time) }} ~ {{ formatTime(segment.end_time) }}
                                </div>
                                <br/>
                                {{ segment.text }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {ref, onBeforeUnmount, getCurrentInstance, computed, watch} from 'vue';

export default {
    name: 'AudioUpload',
    setup() {
        const file = ref(null);
        const models = ref([]);
        const outputType = ref([]);
        const modelType = ref('');
        const formatType = ref('');
        const isNeedSegment = ref(true);
        const isLoading = ref(false);
        const progressing = ref(false);
        const progress = ref(null);
        const animatedProgress = ref(0);
        const downloadUrl = ref('');
        const errorMessage = ref('');
        let taskId = ref('');
        let handleMessage = null;
        const segments = ref([]);
        const fullText = ref('');

        const { proxy } = getCurrentInstance();
        const socket = proxy.$socket;

        const protocol = window.location.protocol;
        const host = window.location.host;
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${protocol}//${host}`;

        const subscribeTaskProgress = (id) => {
            socket.sendObj({ action: 'subscribe', taskId: id });

            handleMessage = (event) => {
                console.log('event.data:', event.data);
                const data = JSON.parse(event.data);
                if (data.taskId === taskId.value) {
                    console.log("任務ID:", taskId.value + " 進度:", data.progress);
                    progress.value = data.progress;
                    if (data.progress === 100 || data.status === 'SUCCESS' || data.status === 'FAILED') {
                        progress.value = 100;
                        socket.sendObj({ action: 'unsubscribe', taskId: taskId.value });
                        socket.onmessage = null;
                        setTimeout(() => {
                            progress.value = null;
                            progressing.value = false;
                            downloadUrl.value = data.result.downloadUrl || '';
                            segments.value = data.result.segments || [];
                            fullText.value = data.result.text || '';
                        }, 2000);
                    }
                }
            };

            socket.onmessage = handleMessage;
        };

        const handleFileChange = (event) => {
            file.value = event.target.files[0];
        };

        const handleSubmit = async () => {
            if (!file.value) {
                alert('請選擇一個音檔');
                return;
            } else if (!modelType.value) {
                alert('請選擇一個模型');
                return;
            }

            downloadUrl.value = '';
            segments.value = [];
            fullText.value = '';

            isLoading.value = true;
            errorMessage.value = '';
            progress.value = null;
            animatedProgress.value = 0;

            const formData = new FormData();
            formData.append('file', file.value);
            formData.append('model', modelType.value);
            formData.append('is_need_segment', isNeedSegment.value);
            formData.append('format_type', formatType.value);

            try {
                const response = await fetch(`${apiBaseUrl}/transcription`, {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (result.status === 200 && result.data.taskId) {
                    taskId.value = result.data.taskId;
                    isLoading.value = false;
                    progressing.value = true;
                    progress.value = 0;
                    subscribeTaskProgress(taskId.value);
                } else {
                    new Error('無效的回應資料');
                }
            } catch (error) {
                console.error(error);
                errorMessage.value = '轉錄失敗，請稍後再試。';
                isLoading.value = false;
                progressing.value = false;
            }
        };

        const fetchModels = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/getAvailableModels`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const modelsData = await response.json();
                if (modelsData.data) {
                    models.value = modelsData.data;
                    if (models.value.length > 0) {
                        modelType.value = models.value[0].code;
                    }
                }
            } catch (error) {
                console.error('取得模型失敗:', error);
                errorMessage.value = '無法取得可用模型，請稍後再試。';
            }
        };

        const fetchOutputType = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/getAvailableOutputTypes`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                const outputTypeData = await response.json();
                if (outputTypeData.data) {
                    outputType.value = outputTypeData.data;
                    if (outputType.value.length > 0) {
                        formatType.value = outputType.value[0];
                    }
                }
            } catch (error) {
                console.error('取得輸出格式失敗:', error);
                errorMessage.value = '無法取得輸出格式，請稍後再試。';
            }
        };

        const formatTime = (time) => {
            return parseFloat(time).toFixed(2) + 's';
        };

        watch(progress, (newProgress) => {
            if (newProgress < animatedProgress.value) {
                return;
            }
            const start = animatedProgress.value;
            const end = newProgress;
            const duration = Math.random() * 3000;
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                if (elapsed < duration) {
                    const newProgress = start + (end - start) * (elapsed / duration);
                    if (newProgress > animatedProgress.value) {
                        animatedProgress.value = newProgress;
                    }
                    requestAnimationFrame(animate);
                } else {
                    if (end > animatedProgress.value) {
                        animatedProgress.value = end;
                    }
                }
            };
            requestAnimationFrame(animate);
        });

        onBeforeUnmount(() => {
            socket.onmessage = null;
        });

        fetchModels();
        fetchOutputType();

        return {
            file,
            models,
            outputType,
            modelType,
            formatType,
            isNeedSegment,
            isLoading,
            progress,
            animatedProgress,
            downloadUrl,
            errorMessage,
            progressing,
            taskId,
            handleFileChange,
            handleSubmit,
            segments,
            fullText,
            formatTime,
            hasResult: computed(() => downloadUrl.value || segments.value.length > 0),
        };
    },
};
</script>

<style scoped>
.upload-container {
    max-width: 1200px;
    margin: 50px auto;
    padding: 2rem;
    background-color: #2e2e2e;
    color: #fff;
    border-radius: 8px;
    position: relative;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2rem;
    height: 85vh;
    padding-bottom: 20px;
}

.upload-container.has-result {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
}

.form-section {
    flex: 1;
    min-width: 300px;
    width: 100%;
}

.upload-container.has-result .form-section {
    width: 30%;
}

.result-section {
    flex: 2;
    max-height: 750px;
    overflow-y: auto;
    width: 65%;
}

.download-center {
    text-align: center;
    margin-bottom: 1rem;
}

.result-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.full-text-container,
.segments-container {
    background-color: #3a3a3a;
    padding: 1rem;
    border-radius: 4px;
}

h1,
h2,
h3 {
    text-align: center;
    color: #fff;
}

.form-group {
    margin-bottom: 1.5rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
}

input[type='file'],
input[type='text'],
select {
    width: 100%;
    padding: 0.5rem;
    background-color: #3a3a3a;
    border: 1px solid #555;
    border-radius: 4px;
    color: #fff;
}

.switch {
    position: relative;
    display: inline-block;
    width: 60px;
    height: 34px;
}

.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: .4s;
    border-radius: 34px;
}

.slider:before {
    position: absolute;
    content: "";
    height: 26px;
    width: 26px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .4s;
    border-radius: 50%;
}

input:checked + .slider {
    background-color: #549970;
}

input:focus + .slider {
    box-shadow: 0 0 1px #549970;
}

input:checked + .slider:before {
    transform: translateX(26px);
}

button {
    width: 100%;
    padding: 0.75rem;
    background-color: #555;
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:disabled {
    background-color: #999;
    cursor: not-allowed;
}

button:hover:not(:disabled) {
    background-color: #777;
}

.result {
    background-color: #3a3a3a;
    padding: 1rem;
    border-radius: 20px;
    text-align: left;
}

.full-text p,
.segments li {
    white-space: pre-wrap;
    font-size: 1.25rem;
    color: #e0e0e0;
}

.segments li {
    background-color: #4a4a4a;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 1.25rem;
    color: #e0e0e0;
}

.error-message {
    margin-top: 1rem;
    color: #ff4d4f;
    text-align: center;
}

.progress-container {
    margin-top: 2rem;
    text-align: center;
}

progress {
    width: 100%;
    height: 20px;
    -webkit-appearance: none;
    appearance: none;
    transition: width 0.3s ease;
}

progress::-webkit-progress-bar {
    background-color: #555;
    border-radius: 4px;
}

progress::-webkit-progress-value {
    background-color: #549970;
}

.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(26, 26, 26, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 8px;
}

.spinner {
    border: 8px solid #f3f3f3;
    border-top: 8px solid #555;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.segment-item {
    background-color: #4a4a4a;
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 20px;
    list-style-type: none;
}


/* 自訂滾輪樣式 */
.result-section::-webkit-scrollbar {
    width: 12px;
}

.result-section::-webkit-scrollbar-track {
    background: #2e2e2e;
}

.result-section::-webkit-scrollbar-thumb {
    background-color: #1c1c1c;
    border-radius: 6px;
    border: 3px solid #2e2e2e;
}

.result-section::-webkit-scrollbar-thumb:hover {
    background-color: #555;
}

.full-text-container p {
    font-size: 1.25rem;
    color: #cfcfcf;
    line-height: 2rem;
    letter-spacing: 0.05rem;
}

.segments-container li {
    font-size: 1.25rem;
    color: #cfcfcf;
    line-height: 2rem;
    letter-spacing: 0.05rem;
}

.download-link {
    color: #1e90ff;
    text-decoration: none;
    font-size: 1.5rem;
}

.download-link:hover {
    color: #63a4ff;
}
</style>