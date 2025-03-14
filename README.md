# 词汇学习应用

一个模仿 Memrise 学习体验的个人词汇学习应用，支持拼音显示和间隔重复学习算法。

## 功能特点

- **课程导入**：支持上传 CSV 文件（格式：单词, 拼音, 释义, 例句, 音频链接）
- **学习模式**：
  - **学新词模块**：预览、尝试、验证三阶段学习流程
  - **快速练习**：60秒内完成50题的挑战模式
  - **难词模式**：针对错误次数达到3次以上的单词进行专项练习
- **复习机制**：基于间隔重复算法，根据答题结果动态调整复习间隔
- **用户数据**：记录每个单词的学习数据，并实时展示学习统计

## 技术栈

- **前端**：Expo (React Native)
- **后端**：FastAPI
- **数据库**：SQLite
- **动画**：使用 react-native-reanimated 和 react-native-gesture-handler

## 项目结构

```
vocabulary-app/
├── frontend/             # Expo 前端应用
│   ├── assets/           # 图片和资源文件
│   ├── components/       # 可复用组件
│   ├── screens/          # 应用屏幕
│   └── App.js            # 应用入口
├── backend/              # FastAPI 后端
│   ├── app/              # 应用代码
│   │   ├── database.py   # 数据库配置
│   │   ├── models.py     # 数据模型
│   │   ├── schemas.py    # Pydantic 模式
│   │   └── routers/      # API 路由
│   └── main.py           # 后端入口
└── README.md             # 项目说明
```

## 安装与运行

### 前端

```bash
# 进入前端目录
cd vocabulary-app/frontend

# 安装依赖
npm install

# 启动应用
npm start
```

### 后端

```bash
# 进入后端目录
cd vocabulary-app/backend

# 安装依赖
pip install -r requirements.txt

# 启动服务器
python main.py
```

## 构建 Android APK

```bash
# 进入前端目录
cd vocabulary-app/frontend

# 使用 EAS Build 构建 APK
npm run build:android
```

## 使用指南

1. **导入词汇**：
   - 创建新课程
   - 上传 CSV 文件（格式：单词, 拼音, 释义, 例句, 音频链接）

2. **学习新词**：
   - 预览阶段：查看单词详情和记忆提示
   - 尝试阶段：回答选择题
   - 验证阶段：查看正确答案和拼音

3. **复习**：
   - 系统会根据间隔重复算法安排复习
   - 回答正确的单词会延长复习间隔
   - 回答错误的单词会缩短复习间隔

4. **难词练习**：
   - 系统自动收集错误次数达到3次以上的单词
   - 提供额外提示和分解练习

5. **快速练习**：
   - 60秒内完成尽可能多的单词
   - 测试你的反应速度和记忆

## 特色设计

- **蓝紫色渐变背景**：从 #4B79A1 至 #283E51 的渐变效果
- **动画反馈**：
  - 正确答案：绿色动画 (#4CAF50) 放大显示
  - 错误答案：红色动画 (#FF5722) 伴随抖动效果
  - 拼音反馈：答题后自动以淡入、弹跳动画显示
