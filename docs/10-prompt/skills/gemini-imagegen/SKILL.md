---
name: gemini-imagegen
description: 使用 Gemini API (Nano Banana Pro) 生成和编辑图像时应使用此技能。它适用于从文本提示创建图像、编辑现有图像、应用样式转换、用文本生成徽标、创建贴纸、产品模型或任何图像生成/操作任务。支持文本转图像、图像编辑、多轮细化以及多个参考图像的合成。
---
# Gemini 图像生成 (Nano Banana Pro)

使用 Google 的 Gemini API 生成和编辑图像。必须设置环境变量`GEMINI_API_KEY`。

## 默认模型

|型号|分辨率|最适合 |
|--------|------------|----------|
| `gemini-3-pro-image-preview` | 1K-4K |所有图像生成（默认）|

**注意：** 始终使用此 Pro 型号。仅在明确要求时才使用不同的模型。

## 快速参考

### 默认设置
- **型号：** `gemini-3-pro-image-preview`
- **分辨率：** 1K（默认，选项：1K、2K、4K）
- **纵横比：** 1:1（默认）

### 可用的宽高比
`1:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`

### 可用分辨率
`1K`（默认）、`2K`、`4K`

## 核心 API 模式
```python
import os
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

# Basic generation (1K, 1:1 - defaults)
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Your prompt here"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
    ),
)

for part in response.parts:
    if part.text:
        print(part.text)
    elif part.inline_data:
        image = part.as_image()
        image.save("output.png")
```
## 自定义分辨率和宽高比
```python
from google.genai import types

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",  # Wide format
            image_size="2K"       # Higher resolution
        ),
    )
)
```
### 分辨率示例
```python
# 1K (default) - Fast, good for previews
image_config=types.ImageConfig(image_size="1K")

# 2K - Balanced quality/speed
image_config=types.ImageConfig(image_size="2K")

# 4K - Maximum quality, slower
image_config=types.ImageConfig(image_size="4K")
```
### 纵横比示例
```python
# Square (default)
image_config=types.ImageConfig(aspect_ratio="1:1")

# Landscape wide
image_config=types.ImageConfig(aspect_ratio="16:9")

# Ultra-wide panoramic
image_config=types.ImageConfig(aspect_ratio="21:9")

# Portrait
image_config=types.ImageConfig(aspect_ratio="9:16")

# Photo standard
image_config=types.ImageConfig(aspect_ratio="4:3")
```
## 编辑图像

传递带有文本提示的现有图像：
```python
from PIL import Image

img = Image.open("input.png")
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Add a sunset to this scene", img],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
    ),
)
```
## 多轮细化

使用聊天进行迭代编辑：
```python
from google.genai import types

chat = client.chats.create(
    model="gemini-3-pro-image-preview",
    config=types.GenerateContentConfig(response_modalities=['TEXT', 'IMAGE'])
)

response = chat.send_message("Create a logo for 'Acme Corp'")
# Save first image...

response = chat.send_message("Make the text bolder and add a blue gradient")
# Save refined image...
```
## 提示最佳实践

### 逼真的场景
包括相机详细信息：镜头类型、灯光、角度、情绪。
> “逼真的特写肖像，85mm 镜头，柔和的黄金时段光线，浅景深”

### 风格化艺术
明确指定样式：
> “卡哇伊风格的快乐小熊猫贴纸，粗体轮廓，卡通阴影，白色背景”

### 图像中的文本
明确字体样式和位置：
> “使用干净的无衬线、黑白、咖啡豆图案的文本‘Daily Grind’创建徽标”

### 产品模型
描述照明设置和表面：
> “工作室照明的抛光混凝土产品照片，三点柔光箱设置，45 度角”

## 高级功能

### Google 搜索基础
根据实时数据生成图像：
```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=["Visualize today's weather in Tokyo as an infographic"],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        tools=[{"google_search": {}}]
    )
)
```
### 多个参考图像（最多 14 个）
组合来自多个来源的元素：
```python
response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=[
        "Create a group photo of these people in an office",
        Image.open("person1.png"),
        Image.open("person2.png"),
        Image.open("person3.png"),
    ],
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
    ),
)
```
## 重要提示：文件格式和媒体类型

**关键：** Gemini API 默认返回 JPEG 格式的图像。保存时，请始终使用 `.jpg` 扩展名，以避免媒体类型不匹配。
```python
# CORRECT - Use .jpg extension (Gemini returns JPEG)
image.save("output.jpg")

# WRONG - Will cause "Image does not match media type" errors
image.save("output.png")  # Creates JPEG with PNG extension!
```
### 转换为 PNG（如果需要）

如果您特别需要 PNG 格式：
```python
from PIL import Image

# Generate with Gemini
for part in response.parts:
    if part.inline_data:
        img = part.as_image()
        # Convert to PNG by saving with explicit format
        img.save("output.png", format="PNG")
```
### 验证图像格式

使用 `file` 命令检查实际格式与扩展名：
```bash
file image.png
# If output shows "JPEG image data" - rename to .jpg!
```
## 注释

- 所有生成的图像都包含 SynthID 水印
- Gemini 返回 **默认 JPEG 格式** - 始终使用 `.jpg` 扩展名
- 仅图像模式 (`responseModalities: ["IMAGE"]`) 不适用于 Google 搜索接地
- 对于编辑，以对话方式描述更改 - 模型理解语义屏蔽
- 默认为 1K 分辨率以提高速度；当质量至关重要时使用 2K/4K
