/*
 * @Author: Arno.su
 * @Date: 2021-11-24 16:06:04
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 13:49:26
 */
import type { Plugin } from 'vite';
import fs from 'fs';
import { type Options } from '../oss_plugin/qiniu';
import NpmQiniuPlugin from '../npm_plugin/npmQiniuPlugin';

const PLUGIN_NAME = 'vite-plugin-upload-oss-qiniu';

export default function vitePluginQiniu(options: Options): Plugin {
  const qiniu = new NpmQiniuPlugin(options);
  let outputPath = '';

  const getFilePaths = (pathName: string): string[] => {
    const files = fs.readdirSync(pathName);
    return files
      .map((item: string) => {
        const filePath = `${pathName}/${item}`;
        const stat = fs.lstatSync(filePath);
        if (stat.isDirectory()) {
          return getFilePaths(filePath);
        } else {
          return pathName === outputPath
            ? item
            : filePath.replace(`${outputPath}/`, '');
        }
      })
      .flat();
  };

  return {
    name: PLUGIN_NAME,
    apply: 'build',
    configResolved: async (config) => {
      outputPath = config.build.outDir;
    },
    closeBundle() {
      const filePathAry = getFilePaths(outputPath);
      qiniu.apply({
        filePathAry,
        outputPath,
      });
    },
  };
}
