let config = {
    apiUrl: "",
    wsUrl: "",
    prod: true,
    allowHosts: ['localhost:5173']
}

config.apiUrl = config.prod ? 'http://localhost:10880/api' : ""
config.wsUrl = config.prod ? 'ws://localhost:10880/ws/task' : ""

export default config;