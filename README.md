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
      bucket: '', 
      forceDelete: true
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
      bucket: '', 
      forceDelete: true
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
|  forceDelete   |  boolean   |  false   |  false   |  上传文件前，先强制删除之前上传七牛云上的文件   |
|  rootName   |  string   |  '项目名称'   |  false   |  文件上传的根目录名称  |
|  isLog   |  boolean   |  false   |  false   |  是否打印上传日志   |
