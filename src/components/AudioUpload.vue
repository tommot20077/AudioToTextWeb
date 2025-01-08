<template>
    <div class="upload-container">
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
                <input type="checkbox" id="segment" v-model="isNeedSegment"/>
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
            <progress :value="progress" max="100"></progress>
            <span>{{ progress }}%</span>
        </div>

        <div v-if="downloadUrl" class="result">
            <h2>轉錄完成！</h2>
            <a :href="downloadUrl" target="_blank">下載結果</a>
        </div>
    </div>
</template>

<script>
import {ref, onBeforeUnmount, getCurrentInstance} from 'vue';

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
        const downloadUrl = ref('');
        const errorMessage = ref('');
        let taskId = ref('');
        let handleMessage = null;

        const { proxy } = getCurrentInstance();
        const socket = proxy.$socket;

        const subscribeTaskProgress = (id) => {
            // 發送訂閱消息給服務器
            socket.sendObj({ action: 'subscribe', taskId: id });

            // 設置消息處理函數
            handleMessage = (event) => {
                console.log('event.data:', event.data);
                const data = JSON.parse(event.data);
                if (data.taskId === taskId) {
                    console.log("任務ID:", taskId + " 進度:", data.progress);
                    progress.value = data.progress;
                    if (data.progress === 100 || data.status === 'SUCCESS' || data.status === 'FAILED') {
                        progress.value = null
                        progressing.value = false;
                        downloadUrl.value = data.result.downloadUrl || '';
                        socket.sendObj({ action: 'unsubscribe', taskId: taskId });
                        socket.onmessage = null;
                    }
                }
            };

            // 註冊消息監聽器
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

            isLoading.value = true;
            errorMessage.value = '';
            progress.value = null;
            downloadUrl.value = '';

            const formData = new FormData();
            formData.append('file', file.value);
            formData.append('model', modelType.value);
            formData.append('is_need_segment', isNeedSegment.value);
            formData.append('format_type', formatType.value);

            try {
                const response = await fetch('http://138.2.33.143:8077/api/transcription', {
                    method: 'POST',
                    body: formData,
                });
                const result = await response.json();
                if (result.status === 200 && result.data.taskId) {
                    taskId = result.data.taskId;
                    isLoading.value = false; // 關閉 loading 指示器
                    progressing.value = true; // 開啟進度指示器
                    progress.value = 0; // 初始化進度
                    subscribeTaskProgress(taskId); // 訂閱進度
                } else {
                    throw new Error('無效的回應資料');
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
                const response = await fetch('http://138.2.33.143:8077/api/getAvailableModels', {
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
                const response = await fetch('http://138.2.33.143:8077/api/getAvailableOutputTypes', {
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

        onBeforeUnmount(() => {
            socket.onmessage = null;
        });

        // 初始化資料
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
            downloadUrl,
            errorMessage,
            progressing,
            taskId,
            handleFileChange,
            handleSubmit,
        };
    },
};
</script>

<style scoped>
.upload-container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    background-color: #1a1a1a;
    color: #fff;
    border-radius: 8px;
    position: relative;
}

h1,
h2 {
    text-align: center;
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
    background-color: #333;
    border: 1px solid #555;
    border-radius: 4px;
    color: #fff;
}

input[type='checkbox'] {
    transform: scale(1.2);
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
    margin-top: 2rem;
    background-color: #2a2a2a;
    padding: 1rem;
    border-radius: 4px;
    text-align: center;
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
</style>