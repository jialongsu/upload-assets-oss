/*
 * @Author: Arno.su
 * @Date: 2022-10-21 13:40:51
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 13:49:15
 */
import { type Options } from '../oss_plugin/qiniu';
import NpmQiniuPlugin from '../npm_plugin/npmQiniuPlugin';

const PLUGIN_NAME = 'webpack-plugin-upload-oss-qiniu';

class WebpackPluginQiniu {
  qiniu: NpmQiniuPlugin;

  constructor(options: Options) {
    this.qiniu = new NpmQiniuPlugin(options);
  }

  apply(compiler: any) {
    compiler.hooks.afterEmit.tapAsync(
      PLUGIN_NAME,
      async (compilation: any, callback: any) => {
        const filePathAry = Object.keys(compilation.assets);
        const outputPath = compilation.options.output.path;

        callback();
        this.qiniu.apply({ filePathAry, outputPath });
      }
    );
  }
}

export default WebpackPluginQiniu;
