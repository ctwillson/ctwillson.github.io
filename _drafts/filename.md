---
title: efuse、secure boot、lock bootloader
tags: 新建,模板,小书匠
grammar_cjkRuby: true
---


欢迎使用 **{小书匠}(xiaoshujiang)编辑器**，您可以通过==设置==里的修改模板来改变新建文章的内容。
## efuse
### efuse简介
`eFuse的诞生源于几年前IBM工程师的一个发现：与更旧的激光熔断技术相比，电子迁移(EM)特性可以用来生成小得多的熔丝结构。EM熔丝可以在芯片上编程，不论是在晶圆探测阶段还是在封装中。采用I/O电路的片上电压(通常为2.5V)，一个持续200微秒的10毫安直流脉冲就足以编程单根熔丝。`
### efuse应用
从前面的概念可以知道，efuse的部分只能写一次，之后便无法重新写入了。应用与这一特性，可以存放一些设备出厂后不希望被更改的东西，比如chip id等。这样子这部分就无法被更改，比如用户遗失手机，远程锁机后，无法通过刷机进行解锁机子。其实，之前有部分大神通过更换EMMC达到解锁手机，那现在通过这种技术，绑定chip id，即使更换了EMMC，也无法实现开机了。
高通位于sec分区 	sec.dat，存放安全启动的配置，用于efuse熔断 	fastboot flash sec sec.dat
## EFS
### EFS简介
EFS（Encrypting File System ）加密文件系统
### EFS应用

高通mbn是高通包含了特定运营商定制的一套efs，nv的集成包文件。同样的mbn文件会有很多。每个运营商都会有一个特定mbn包含在modem的代码中。modemst1	modem配置数据文件系统1 efs 	 
modemst2 	modem配置数据文件系统2 efs

## lock bootloader
### lock bootloader简介
喜欢刷机的朋友，经常会看到锁bootloader。其实锁bootloder其实很顾名思义，就是把bootloader分区给锁住了，我们知道整个系统起来的第一步就是在bootloder阶段，锁住了bootloder就无法通过fastboot刷机了，也就是常说的线刷。

