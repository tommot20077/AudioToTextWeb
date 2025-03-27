<template>
    <div class="page-container">
        <div class="side-tabs">
            <button :class="{ active: currentTab === 'add' }" @click="currentTab = 'add'">新增任務</button>
            <button :class="{ active: currentTab === 'query' }" @click="currentTab = 'query'">查詢任務</button>
        </div>

        <div class="main-content">
            <div v-if="currentTab === 'add'"
                 class="query-container"
                 :class="{'has-result': downloadUrl || segments.length}">
                <div class="form-section">
                    <h1>音檔轉錄</h1>
                    <form @submit.prevent="handleSubmit">
                        <div class="form-group">
                            <label for="file">選擇音檔：</label> <input type="file"
                                                                       id="file"
                                                                       @change="handleFileChange"
                                                                       required/>
                        </div>
                        <div class="form-group">
                            <label for="model">模型類型：</label> <select id="model" v-model="modelType" required>
                            <option v-for="model in models" :key="model.code" :value="model.code">
                                {{ model.description }}
                            </option>
                        </select>
                        </div>
                        <div class="form-group">
                            <label for="format">格式類型：</label> <select id="format" v-model="formatType" required>
                            <option v-for="type in outputType" :key="type" :value="type">
                                {{ type }}
                            </option>
                        </select>
                        </div>
                        <div class="form-group">
                            <label for="segment">需要分段：</label> <label class="switch"> <input type="checkbox"
                                                                                                 id="segment"
                                                                                                 v-model="isNeedSegment"/>
                            <span class="slider round"></span> </label>
                        </div>
                        <button type="submit" :disabled="isLoading || progressing">
                            {{ isLoading || progressing ? '轉錄中...' : '上傳並轉錄' }}
                        </button>
                        <div v-if="errorMessage" class="error-message">
                            {{ errorMessage }}
                        </div>
                        <div v-if="taskId" class="taskId-message">
                            本次任務ID: {{ taskId }}
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
                                        <br/> {{ segment.text }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-else-if="currentTab === 'query'" class="query-container" :class="{'has-result': queryResult}">
                <div class="form-section">
                    <h1>查詢任務</h1>
                    <form @submit.prevent="queryTask">
                        <div class="form-group">
                            <label for="queryTaskId">輸入任務ID：</label> <input type="text"
                                                                                id="queryTaskId"
                                                                                v-model="queryTaskId"
                                                                                placeholder="請輸入任務ID"
                                                                                required/>
                        </div>
                        <button type="submit" :disabled="isQuerying">
                            {{ isQuerying ? '查詢中...' : '查詢' }}
                        </button>
                        <div v-if="queryErrorMessage" class="error-message">
                            {{ queryErrorMessage }}
                        </div>
                    </form>

                    <div v-if="queryProgress !== null" class="progress-container">
                        <h2>查詢進度：</h2>
                        <progress :value="animatedQueryProgress" max="100"></progress>
                        <span>{{ animatedQueryProgress.toFixed(2) }}%</span>
                    </div>
                </div>

                <div v-if="queryResult" class="result-section">
                    <div class="result">
                        <div class="download-center" v-if="queryResult.downloadUrl">
                            <h1>轉錄完成！</h1>
                            <a :href="queryResult.downloadUrl" target="_blank" class="download-link">下載檔案</a>
                        </div>
                        <div class="result-content">
                            <div class="full-text-container">
                                <h3>完整句子：</h3>
                                <p class="segment-item">{{ queryResult.text }}</p>
                            </div>
                            <div class="segments-container" v-if="queryResult.segments && queryResult.segments.length">
                                <h3>分段句子：</h3>
                                <ul>
                                    <li v-for="segment in queryResult.segments"
                                        :key="segment.start_time"
                                        class="segment-item">
                                        <div style="text-align: center;">
                                            {{ formatTime(segment.start_time) }} ~ {{ formatTime(segment.end_time) }}
                                        </div>
                                        <br/> {{ segment.text }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import {ref, onBeforeUnmount, getCurrentInstance, computed, watch} from 'vue';
import Config from "../../config.ts";

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
        const handleMessages = ref([]);
        const segments = ref([]);
        const fullText = ref('');

        const queryTaskId = ref('');
        const isQuerying = ref(false);
        const queryProgress = ref(null);
        const animatedQueryProgress = ref(0);
        const queryResult = ref(null);
        const queryErrorMessage = ref('');

        const {proxy} = getCurrentInstance();
        const socket = proxy.$socket;

        const currentTab = ref('add');

        watch(currentTab, (newTab) => {
            document.title = newTab === 'add' ? '音檔轉錄 - 新增任務' : '音檔轉錄 - 查詢任務';
        }, { immediate: true });


        const subscribeTaskProgress = (id, isQuery = false) => {
            socket.sendObj({action: 'subscribe', taskId: id});

            const handleMessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.taskId === id) {
                    if (isQuery) {
                        queryProgress.value = data.progress;
                    } else {
                        progress.value = data.progress;
                    }
                    if (data.progress === 100 || data.status === 'SUCCESS' || data.status === 'FAILED') {
                        if (isQuery) {
                            queryProgress.value = 100;
                        } else {
                            progress.value = 100;
                        }
                        setTimeout(() => {
                            if (isQuery) {
                                queryProgress.value = null;
                                isQuerying.value = false;
                                if (data.status === 'SUCCESS') {
                                    queryResult.value = {
                                        downloadUrl: data.result.downloadUrl || '',
                                        segments: data.result.segments || [],
                                        text: data.result.text || ''
                                    };
                                } else {
                                    queryErrorMessage.value = '任務處理失敗: ' + data.result.error;
                                }
                            } else {
                                progress.value = null;
                                progressing.value = false;
                                downloadUrl.value = data.result.downloadUrl || '';
                                segments.value = data.result.segments || [];
                                fullText.value = data.result.text || '';
                            }
                        }, 2000);
                    }
                }
            };
            socket.addEventListener('message', handleMessage);
            handleMessages.value.push(handleMessage);
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
            taskId.value = '';

            const formData = new FormData();
            formData.append('file', file.value);
            formData.append('model', modelType.value);
            formData.append('is_need_segment', isNeedSegment.value);
            formData.append('format_type', formatType.value);

            try {
                const response = await fetch(`${Config.apiUrl}/transcription`, {
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

        const queryTask = async () => {
            if (!queryTaskId.value) {
                alert('請輸入任務ID');
                return;
            }

            queryResult.value = null;
            queryErrorMessage.value = '';
            isQuerying.value = true;
            queryProgress.value = null;
            animatedQueryProgress.value = 0;
            subscribeTaskProgress(queryTaskId.value, true);
        };

        const fetchModels = async () => {
            try {
                const response = await fetch(`${Config.apiUrl}/getAvailableModels`, {
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
                const response = await fetch(`${Config.apiUrl}/getAvailableOutputTypes`, {
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

        const animateProgress = (newProgress, animatedProgressRef) => {
            if (newProgress < animatedProgressRef.value) {
                return;
            }
            const start = animatedProgressRef.value;
            const end = newProgress;
            const duration = Math.random() * 3000;
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                if (elapsed < duration) {
                    const updatedProgress = start + (end - start) * (elapsed / duration);
                    if (updatedProgress > animatedProgressRef.value) {
                        animatedProgressRef.value = updatedProgress;
                    }
                    requestAnimationFrame(animate);
                } else {
                    if (end > animatedProgressRef.value) {
                        animatedProgressRef.value = end;
                    }
                }
            };
            requestAnimationFrame(animate);
        };

        watch(progress, (newProgress) => {
            if (newProgress !== null) {
                animateProgress(newProgress, animatedProgress);
            }
        });

        watch(queryProgress, (newProgress) => {
            if (newProgress !== null) {
                animateProgress(newProgress, animatedQueryProgress);
            }
        });

        onBeforeUnmount(() => {
            handleMessages.value.forEach((handler) => {
                socket.removeEventListener('message', handler);
            });
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

            queryTaskId,
            isQuerying,
            queryProgress,
            animatedQueryProgress,
            queryResult,
            queryErrorMessage,
            queryTask,

            currentTab
        };
    },
};
</script>

<style scoped>


.form-section {
    flex: 1;
    min-width: 300px;
    width: 100%;
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
    justify-content: flex-start;
    overflow-wrap: break-word;
}

h1,
h2,
h3 {
    text-align: center;
    color: #fff;
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

.taskId-message {
    margin-top: 1rem;
    color: #97caf7;
    text-align: center;
}

.progress-container {
    margin-top: 2rem;
    text-align: center;
    width: 100%;
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
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 8px;
    width: 100px;
    height: 100px;
    z-index: 1000;
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
    word-break: break-word;
    white-space: pre-wrap;
}


.result-section::-webkit-scrollbar {
    width: 1.3rem;
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

body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.page-container {
    display: flex;
    width: 100%;
    height: 100vh;
    background-color: #1a1a1a;
    overflow: hidden;
}

.side-tabs {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    background-color: #2e2e2e;
    min-width: 120px;
    z-index: 10;
}

.side-tabs button {
    margin: 0.5rem 0;
    padding: 1rem;
    width: 100%;
    background-color: #555;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.3s;
    text-align: center;
    white-space: nowrap;
}

.side-tabs button.active {
    background-color: #1e90ff;
}

.side-tabs button:hover:not(.active) {
    background-color: #777;
}

.main-content {
    flex: 1;
    padding: 2rem;
    overflow-y: hidden;
    display: flex;
    justify-content: center;
    position: relative;
}

.result {
    background-color: #3a3a3a;
    padding: 1rem;
    border-radius: 20px;
    height: fit-content;
}


.query-container {
    width: 100%;
    max-width: 1600px;
}

.query-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: #2e2e2e;
    padding: 2rem;
    border-radius: 8px;
    color: #fff;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    height: 85vh;
    width: fit-content;
    min-width: 500px;
    max-width: 700px;
}

.query-container.has-result {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    max-width: 1200px;
    gap: 2rem;
}

.query-container .form-section {
    width: 100%;
}

.query-container.has-result .form-section {
    width: 30%;
    min-width: 300px;
}

.query-container .result-section {
    flex: 2;
    min-width: 0;
    max-height: 750px;
    overflow-y: auto;
}

@media screen and (max-width: 1200px) {
    .query-container.has-result {
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        height: auto;
        max-height: none;
    }

    .query-container.has-result .form-section {
        width: 100%;
        max-width: 500px;
    }

    .query-container .result-section {
        width: 100%;
        max-height: 500px;
    }
}

@media screen and (max-width: 768px) {
    .page-container {
        flex-direction: column;
    }

    .side-tabs {
        flex-direction: row;
        justify-content: center;
        min-width: auto;
        width: 100%;
        padding: 0.5rem;
    }

    .side-tabs button {
        margin: 0 0.5rem;
        padding: 0.5rem 1rem;
    }

    .main-content {
        padding: 1rem;
        height: calc(100vh - 70px);
    }

    .query-container {
        padding: 1rem;
        width: 100%;
        max-width: none;
    }

    .query-container.has-result {
        padding: 1rem;
    }

    .loading-overlay {
        width: 80px;
        height: 80px;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border-width: 6px;
    }
}

.form-group {
    margin-bottom: 1.5rem;
    width: 100%;
}


</style>