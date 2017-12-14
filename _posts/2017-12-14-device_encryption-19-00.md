---
layout: post
title: android全盘加密简析
categories: Android secure
description: tee、全盘加密
keywords: 是
---


项目中出现了全盘加密后的设备，无法挂载/data，所以写了这篇文章。android全盘加密原理简析。
## 什么是全盘加密
`全盘加密是使用已加密的密钥对 Android 设备上的所有用户数据进行编码的过程。设备经过加密后，所有由用户创建的数据在写入磁盘之前都会自动加密，并且所有读取操作都会在将数据返回给调用进程之前自动解密数据。`这里需要注意了：1、**使用已加密的密钥** 2、**所有用户数据**。密钥是如何生成的呢？如何对密钥进行加密的？所有用户数据是那部分？我们带着这些问题开始分析这个全盘加密 
Android 5.0 中又引入了以下新功能：

  - 创建了快速加密方式，这种加密方式只会对数据分区中已使用的分块进行加密，以免首次启动用时过长。目前只有 EXT4 和 F2FS 文件系统支持快速加密。
  - 添加了 forceencrypt fstab 标记，以便在首次启动时进行加密。（系统刚开机的时候，通过fstab文件知道是否要进行加密）
  - 添加了对解锁图案和无密码加密的支持。（首次开机时，如果设备开启了全盘加密，即便用户未设置密码时，依旧会进行加密操作）
  - 添加了由硬件支持的加密密钥存储空间，该空间使用可信执行环境（TEE，例如 TrustZone）的签名功能。（原来是通过TEE对密钥进行加密操作的。） 
Android 7.0中又引入了文件加密方式。
## 全盘加密对用户的影响
### 安全性
全盘加密从名字就可以知道，加密，当然可以保护用户数据的不被窃取。那我们之前可能会有疑问，我们通过给我们的设备设置指纹，密码，对方不也不是不能获取我们的数据吗，为什么还要打开这个功能？其实，如果对方拿到你的手机，通过把你的内存取出来拿到其他设备上，不就可以读取数据了吗。全盘加密就是为了解决这个问题。
### 性能影响
打开了全盘加密后，安全性虽然提高了，但是设备的IO读写性能却大大降低。据统计，IO读取的速度会相比没打开全盘加密设备速度降低30%。未打开全盘加密的设备，都是直接将真实的物理设备mount到data分区，而打开全盘加密后，mount的是虚拟的dm-x，用户每次往手机里保存数据，都是先把数据存到dm-x这个虚拟设备，然后dm-x对数据进行加密再存储到真实的物理设备中，而读取数据则是反之。给用户的体验，就是第一次开机需要很长时间，向手机里面拷贝大文件等操作速度较慢。
### 如何知道设备是否开启全盘加密
手机连接adb，之后adb shell进入到命令行，输入mount |grep "/data"，如果答应的信息如下:
```
/dev/block/dm-1 on /data type ext4 (rw,seclabel,nosuid,nodev,noatime,discard,noauto_da_alloc,resuid=10010,data=ordered)
```
如果打印的信息是，那么设备是未打开全盘加密的
```
/dev/block/xxx/xxx/userdata on /data type ext4 (rw,seclabel,nosuid,nodev,noatime,discard,noauto_da_alloc,resuid=10010,data=ordered)
```
到这里，相关基础概念说完了，下面来简单谈谈整个全盘加密的实现流程。
## 全盘加密流程分析

代码路径：
  - init源码：system/core/init 
  - init.rc：system/core/rootdir/ 
  - init.flo.rc,fstab.flo等文件：device/<platform> 
  - fs_mgr.c：system/core/fs_mgr/ 
  - vold源码：system/vold/ 
  - device mapper代码：kernel/drivers/md
占位，最近bug太多了，忘记更新，代码流程分析待更新
