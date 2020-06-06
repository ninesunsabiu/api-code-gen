# api-code-gen
用于生成项目中与后端交互的 API 接口文件  
通过读取 swagger 中的 json 并解析其三类参数(path, query, body)并结合自身项目中封装的 axios 形成调用接口

## Usage
```bash
deno run --allow-write  --allow-read --allow-net \
./api-code-gen.ts \
$SwaggerJsonPath \
$Cookie \
$API \
$FuncName \
$Output
```
|参数|说明|
|:--:|:--:|
|SwaggerJsonPath|swagger /v2/api-docs 的全路径|
|Cookie|由于项目内的 swagger 需要登录使用 可以使用cookie|
|API|后端服务中的 URL mapping 可以从 swagger 中拷贝|
|FuncName|自定义方法名|
|Output|输出文件路径，不存在时将会创建，存在时追加内容|

## Note
- 如你所见 使用了 deno 1.0.0(v8 8.4.300/typescript 3.9.2)
- 如果 raw.githubusercontent.com 无法访问 请善用搜索引擎解决问题