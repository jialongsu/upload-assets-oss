/*
 * @Author: Arno.su
 * @Date: 2022-10-21 13:28:31
 * @LastEditors: Arno.su
 * @LastEditTime: 2022-10-21 13:37:09
 */
import path from 'path';

/**
 * 获取项目名称
 * @returns string
 */
export const getProjectName = () => path.basename(process.cwd());
