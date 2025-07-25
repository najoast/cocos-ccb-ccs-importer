## 安装插件

如需安装到单个项目下（推荐），只需要将文件夹存放到与 assets 同级的 packages 文件夹下，如果没有 packages 文件夹可以自行创建一个。
如需安装到全局（所有项目），只需要将文件夹存放到 用户/.CocosCreator/packages 下。

## 菜单入口：

![image](https://user-images.githubusercontent.com/7564028/116521766-f7f72800-a906-11eb-878b-6d0882d16773.png)

---

# Fork 说明

> [!NOTE]  
> 目前本插件已处于生产环境可用状态 (Production-Ready)，请放心使用。

如果你想把一个使用 Cocos Studio 或 Cocos Builder 开发的 cocos2dx 项目转成 Cocos Creator 项目，目前的路径是：
1. 从 2dx -> Creator 2.x
2. Creator 2.x -> Creator 3.x

其中第2步，官方已经做了很好的支持。但是第1步可就难了，如果你用 Creator 2.x 导过 ccs 或 ccb，你就会发现这个功能 bug 很多，完全没法用。

实际上 Creator 2.x 内置的转换工具，就是来自于本插件（我合理的猜测），而本插件呢，也停止维护了。我尝试在 2.x 里用这个插件导，结果和内置的一样，甚至报错都一样。

于是在发现这个插件后，我就 Fork 了一份出来修改它的 BUG，最终得以把我的 2800+ csd 文件成功导入 Creator 2.x, 之后导入 3.x 就没任何问题了，因为官方对这个工具做了精心维护。

## 本插件的价值

我可以毫不夸张的说，对于 2dx 老项目转 Creator 来说，这是最关键的一步。因为这是脏活、累活，是程序员最不愿意干的活，也是 AI 最无能为力的地方。只要这一步完成了，后面的事就都可以交给 AI 来做了。

因此，我敢断言，对于真正需要的项目来说，这个插件是无价之宝。

以上是我在把一个 2dx 项目转 Creator，被折磨了几个月后得到的感悟。

## 具体的转换步骤
最后再说一下我的转换步骤，以及用到的工具吧。因为这些信息我也是花了很多时间搜集资料和试错后得来的。

仅限使用 Cocos Studio 做界面的项目。

1. 使用 [csb2csd](https://github.com/najoast/csb2csd) 把 csb 转为 csd
	- 如果你有 csd 文件，这步可以跳过
2. 下载并安装 Cocos Creator 2.4.15
	- 这是 2.x 的最后一个版本，也是我试过可行的，一定用这个版本
	- 不确定 2.x 版本还能存在多久，且用且珍惜。如果真的不存在了，可以去[这里](https://github.com/fusijie/Cocos-Resource)翻翻历史，看能不能下到
3. 新建一个空的 Creator 2.4.15 项目
4. 下载并安装本插件
	- 2.x 版本官方有自带的导入功能，位于 `文件->导入项目`，千万不要用
	- 安装本插件后，通过 `插件->导入项目` 来导入
5. 导入你的 Cosos Studio 项目 (*.ccs)
	- 如果一切顺利，你应该能初见杀（一次性导入通过）
	- 我导入 2800+ 文件，应该已经覆盖了大部分使用场景
	- 导入过程中会遇到成吨的 Error 和 Warn, 只要没中断就无视，其中最多的是 `download failed xxx .json`，这个问题也可以无视，不影响导入
6. 再打开或新建一个 Creator 3.x 项目，导入上一步的 2.x 项目

## 授人以渔
如果你在导入过程中，真的遇到问题导致中断了，怎么办？

交给 AI，把你遇到的问题发给它，结合代码，它基本能发现问题。

本项目在 Fork 后的所有提交，都是这么来的。

我用的是 `VSCode + Copilot + Claude Sonnet 4`



