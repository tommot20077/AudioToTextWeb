## 音檔轉錄網頁

### 介紹

這是一個簡單的網頁應用程式，使用 Vue3進行開發，用於搭配 [後端語音轉錄專案](https://github.com/tommot20077/AudioToText) ，
提供一個簡單的介面來上傳音檔並獲取轉錄結果。

### 功能

- 上傳音檔
- 顯示轉錄結果
- 顯示轉錄進度
- 下載轉錄結果

### 安裝說明

這邊僅包含前端的安裝，後端請參考 [後端庫](https://github.com/tommot20077/AudioToText) 的說明。<br>

#### Docker 安裝

- 前置需求
    - Docker 20.10.0 或以上
    - Docker Compose 1.29.2 或以上

- 安裝步驟
    1. 先下載位於 [本專案](https://github.com/tommot20077/AudioToTextWeb/blob/master/docker) 的
       `docker/docker-compose.yml`
       以及 `docker/Dockerfile-end` 檔案 (補充說明：可以直接將Dockerfile-end放入跟後端專案的資料夾下，並直接將
       `docker-compose.yml` 內容添加在後端的docker-compose.yml中即可同時安裝前後端了)
    2. 將這兩個檔案放在專案根目錄下並執行
       ```bash
       docker-compose up -d
       ```
    3. 等待容器啟動完成後，使用瀏覽器訪問 `http://localhost:10881` 即可使用網頁應用程式。
    