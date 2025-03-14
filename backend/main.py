import uvicorn
import os
from app.main import app

# 获取 PORT 环境变量，如果不存在就用 8000 作为默认端口
port = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
