"""FastAPI 后端：txt 文件导入 + 生成内容发送。

作为「传统后端」层，通过 HTTP 对 `literary_agent`（Agent 部分）做 REST 封装，
两者解耦：Agent 只负责 LangGraph 流水线，后端只负责接收上传、触发生成、回传产物。
"""
