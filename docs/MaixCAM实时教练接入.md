# MaixCAM 实时教练接入

## MVP 范围

本版本完成一条不传视频的实时链路：

```text
MaixCAM YOLO11-Pose
  → 本地深蹲状态机与即时提示
  → 独立 Device Gateway（Token 鉴权）
  → 应用内存设备状态
  → 首页/关卡页外置教练状态卡
  → 训练 session 可继续交给 DeepSeek 做组后总结
```

实时安全判断在设备端完成。DeepSeek 不逐帧参与，只消费结构化 session，避免网络延迟影响即时纠错。

## 启动服务

在 `server/.env` 增加：

```dotenv
DEVICE_GATEWAY_ENABLED=1
DEVICE_HOST=0.0.0.0
DEVICE_PORT=3180
DEVICE_TOKEN=替换为至少32位随机字符串
```

然后启动：

```bash
cd server
npm start
```

主网页仍在 `127.0.0.1:3000`；局域网只开放设备网关 `3180`，设备网关只接受 `/device/v1/*`，并且不持有 DeepSeek Key。

## 无硬件联调

保持服务运行，在另一个终端执行：

```bash
cd server
DEVICE_TOKEN=与.env相同的token npm run simulate:maixcam
```

打开首页或关卡页，可以看到 MaixCAM 状态卡从未连接变为在线，并显示模拟动作反馈。

## 部署到 MaixCAM

1. 确认设备和电脑在同一 Wi-Fi，或通过 USB 模拟网络互通。
2. 确认设备已有 `/root/models/yolo11n_pose.mud`；也可在配置中修改路径。
3. 将 `maixcam/app.yaml`、`maixcam/main.py` 和 `maixcam/realtime_coach.py` 复制到设备的 `/maixapp/apps/maixcoach/`。
4. 把 `maixcam/config.example.json` 复制为 `/root/maixcoach.json`。
5. 修改电脑局域网 IP、端口和与服务端一致的 `device_token`。
6. 在 MaixCAM 桌面启动 `MaixCoach`。运行前必须先退出 Camera、JIES1 等其他视觉应用；MaixCAM 的视频管线不支持多个应用同时占用。

设备屏幕会显示 `Gateway ONLINE/OFFLINE`。网关离线不会停止本地姿态识别和动作计数。

## 设备接口

所有写接口必须携带：

```http
X-Device-Token: <DEVICE_TOKEN>
```

接口：

- `GET /device/v1/health`：网关存活检查。
- `POST /device/v1/register`：设备注册。
- `POST /device/v1/heartbeat`：每 5 秒心跳。
- `POST /device/v1/events`：实时、已去抖的动作事件。
- `POST /device/v1/sessions`：一组结束后的结构化汇总。

网页通过主应用的 `POST /api/device/status` 读取安全快照，不直接连接设备网关。
一组结束后可调用 `POST /api/device/coach-summary`；服务会读取指定 session（未指定则取最近一组），由 DeepSeek 或明确标记的 stub 生成组后总结。实时安全反馈仍以设备端规则为准。

## 当前深蹲状态机

使用左右髋、膝、踝计算膝关节角：

- 大于约 `155°`：站立。
- 小于约 `125°`：进入下蹲。
- 小于约 `105°`：达到当前 MVP 的深度目标。
- 回到站立：完成一次计数。

阈值只是原型起点，下一步必须用不同身高、服装、镜头距离和侧前方机位进行真机标定。二维单摄像头不能可靠判断所有膝内扣和躯干旋转问题，不应输出医学诊断。

## 下一步

1. 真机统计实际 FPS、关键点丢失率和端到端反馈延迟。
2. 增加站位校准与个体化深度基线。
3. 增加节奏、躯干前倾和左右不对称规则。
4. 将设备 session 映射进 `health_profile_v1.recentSessions`。
5. 组间调用 DeepSeek，生成一句自然语言反馈；安全提示仍使用本地规则。
6. 增加肩部上举、开合跳和弓步动作插件。

## 官方参考

- [MaixCAM 人体关键点检测](https://github.com/sipeed/MaixPy/blob/main/docs/doc/en/vision/body_key_points.md)
- [MaixCAM 与电脑连接](https://github.com/sipeed/MaixPy/blob/main/docs/doc/en/README_MaixCAM.md)
- [Maix 应用通信协议](https://github.com/sipeed/MaixPy/blob/main/docs/doc/en/comm/maix_protocol.md)
