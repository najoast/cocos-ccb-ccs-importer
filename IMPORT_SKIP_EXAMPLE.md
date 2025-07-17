# CSD导入跳过功能使用说明

## 功能概述

新增了导入前检查功能，如果CSD文件已经导入过，则自动跳过，避免重复导入。

## 使用方法

### 1. 默认行为 (跳过已导入的文件)

```javascript
const CSDImporter = require('./csd-importer');

// 原有调用方式，自动跳过已导入的文件
CSDImporter.importCSDFiles(csdFiles, baseResPath, tempResPath, targetRootUrl, function(err) {
    if (err) {
        console.error('导入失败:', err);
    } else {
        console.log('导入完成');
    }
});
```

### 2. 强制重新导入

```javascript
const CSDImporter = require('./csd-importer');

// 强制重新导入所有文件，即使已经存在
CSDImporter.importCSDFiles(csdFiles, baseResPath, tempResPath, targetRootUrl, function(err) {
    if (err) {
        console.error('导入失败:', err);
    } else {
        console.log('导入完成');
        // 获取导入统计信息
        const stats = CSDImporter.getImportStats();
        console.log('导入统计:', stats);
    }
}, { forceReimport: true });
```

### 3. 获取导入统计信息

```javascript
const CSDImporter = require('./csd-importer');

CSDImporter.importCSDFiles(csdFiles, baseResPath, tempResPath, targetRootUrl, function(err) {
    if (err) {
        console.error('导入失败:', err);
    } else {
        console.log('导入完成');
        
        // 获取导入统计信息
        const stats = CSDImporter.getImportStats();
        console.log(`导入统计: 成功导入 ${stats.imported} 个文件，跳过 ${stats.skipped} 个文件`);
    }
});
```

## 配置选项

### options 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| forceReimport | boolean | false | 是否强制重新导入已存在的文件 |

## 日志输出

- 跳过已导入的文件时，会输出：`CSD file xxx.csd already imported (target: xxx), skipping...`
- 强制重新导入时，会输出：`Force reimport enabled for xxx.csd`
- 导入完成时，会输出：`CSD import completed - Imported: X, Skipped: Y`

## 工作原理

1. 在导入每个CSD文件之前，系统会检查目标资源是否已经存在于项目中
2. 通过 `Editor.assetdb.remote.urlToUuid()` 和 `Editor.assetdb.remote.existsByUuid()` 来检查资源是否存在
3. 如果资源已存在且未设置强制重新导入，则跳过该文件
4. 如果设置了强制重新导入，则无论资源是否存在都会重新导入

## 注意事项

- 检查的是最终生成的 `.fire` (场景) 或 `.prefab` (预制体) 文件是否存在
- 跳过的文件仍然会被添加到已导入文件列表中，避免在同一次导入会话中重复处理
- 强制重新导入不会清除已导入文件列表，只是忽略资源数据库中的存在检查
