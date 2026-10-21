# upload-assets-oss

将打包好的静态资源上传至对象存储服务，兼容vite与webpack。

## feature

七牛云oss ✅

阿里云oss ❌

## 安装

```sh
npm install -D upload-assets-oss

or 

yarn add -D upload-assets-oss
```

## vite中使用

```js
import { vitePluginQiniu } from 'upload-assets-oss';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vitePluginQiniu({ 
      accessKey: '',
      secretKey: '', 
      bucket: ''
    }),
  ],
});
```

## webpack中使用

```js
import { WebpackPluginQiniu } from 'upload-assets-oss';

// https://vitejs.dev/config/
module.exports = {
  plugins: [
    new WebpackPluginQiniu({ 
      accessKey: '',
      secretKey: '', 
      bucket: ''
    }),
  ],
};
```

## Options

| Name | Type | Default| Required| Description |
| --- | --- | --- | --- | --- |
|  accessKey   |  string   |  ''   |   true  |  七牛 Access Key   |
|  secretKey   |  string   |  ''  |  true   |  七牛 Secret Key   |
|  bucket   |  string   |  ''   |   true  |  七牛 空间名   |
|  forceDelete   |  boolean   |  false   |  false   |  已弃用，仅兼容旧配置，不再删除远端文件   |
|  rootName   |  string   |  '项目名称'   |  false   |  文件上传的根目录名称  |
|  isLog   |  boolean   |  false   |  false   |  是否打印上传日志   |

## 上传规则

- 每次构建遍历全部本地产物，不再查询远端文件列表或删除远端文件。
- `.html` 文件（扩展名不区分大小写）使用绑定具体文件路径的凭证覆盖上传。
- 非 HTML 文件仅新增；仅在七牛返回 `614` 且错误为 `file exists` 时跳过，并继续上传后续文件。
- 非 HTML 启用 `forceInsertOnly`，同名文件即使内容完全相同，也会返回重复错误并计为跳过。
- 非 HTML 同名文件即使内容不同也会保留远端版本，不根据文件名是否包含哈希改变规则。
- 文件逐个上传；全部处理结束后汇总成功、跳过和失败数量。其他上传错误会使构建失败。
- 覆盖存储文件不会自动刷新 CDN 缓存，需要立即生效时另行刷新对应 URL。

## 验证

```sh
pnpm build
pnpm test
```

测试使用模拟 SDK 回调，不会向七牛上传或删除文件。
