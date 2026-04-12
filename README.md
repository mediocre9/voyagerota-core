<p align="center">
    <h1 align="center">
        VoyagerOTA
    </h1>
    <h3 align="center">
        Firmware OTA Release Distribution Platform
    </h3>
    <p align="center">
    &nbsp;
    <a href="#"><img src="https://img.shields.io/badge/Built_With-Typescript-blue?style=flat-square&color=5a66f6"></a>
    <a href="#"><img src="https://img.shields.io/badge/Platform-Backend-blue?style=flat-square&color=87314f"></a>
    &nbsp;
    <a href="https://github.com/mediocre9/VoyagerOTAClient"><img src="https://img.shields.io/badge/SDK-VoyagerOTAClient-blue?style=flat-square&color=583187"></a>
        &nbsp;
    <a href="#"><img src="https://img.shields.io/badge/Device-ESP32-Blue?style=flat-square&color=57b578"></a>
    <a href="https://github.com/mediocre9/voyager-ota/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square&color=5a66f6"></a>
    </p>
</p>

## What is VoyagerOTA?

VoyagerOTA is a backend platform for managing and distributing firmware updates over-the-air (OTA). It is designed for developers working with embedded devices, providing a structured way to handle firmware releases using monotonic semantic versioning.

The platform supports drafting releases with metadata, validating uploaded binaries, and organizing deployments through staging and production channels. It includes safeguards such as duplicate binary detection, build-type validation, and version conflict prevention. Releases can be tested in staging before being promoted to production, and can be revoked if necessary.

## Features

- [x] Draft releases with versioning and changelogs
- [x] Prevent version collisions and duplicate binaries
- [x] Automatic build type validation
- [x] Staging channel for verified production builds
- [x] Manual promotion to production
- [x] Release revocation

## Planned Features

- [ ] Device update reporting

## Quickstart

> [!NOTE]
> Create a `.env.development` file in the root before running the server.

```env
npm install

# then run server in development mode....
npm run dev

# and then run artifact worker separately.....
npm run artifact-worker
```

## Authentication & Project Setup

1. Sign up.
2. Create a project.
3. Get `projectId` and `apiKey`.
4. Use the credentials in sdk.

## Client Side Device Integration

> [!TIP]
> Use the official client sdk library [**voyagerota-client-lib**](https://github.com/mediocre9/VoyagerOTAClient) to handle OTA updates on ESP32 devices.

```cpp
#define __ENABLE_DEVELOPMENT_MODE__ true
#define CURRENT_FIRMWARE_VERSION "1.0.0"

#include <VoyagerOTAClient.h>
#include <WiFi.h>
using namespace Voyager;

void connectToWifi() {
    WiFi.begin("SSID", "PASSWORD");
    while (WiFi.status() != WL_CONNECTED) {
        Serial.print(".");
        delay(50);
    }
    Serial.println("Connected to Internet");
}

void setup() {
    Serial.begin(9600);
    connectToWifi();
    OTA<HTTPResponseData, VoyagerReleaseModel> ota(CURRENT_FIRMWARE_VERSION);

    ota.setCredentials("voyager-project-id-here....", "voyager-api-key-here...");
    ota.setBaseURL("voyager-base-url.....");

    auto release = ota.fetchLatestRelease();

    if (release && ota.isNewVersion(release->version)) {
        Serial.println("New version available: " + release->version);
        Serial.println("Changelog: " + release->changeLog);
        ota.setDownloadURL(release->downloadURL);
        ota.performUpdate();
    } else {
        Serial.println("No updates available");
    }
}

void loop() {}
```

> [!NOTE]
>
> 1. The `__ENABLE_DEVELOPMENT_MODE__` must be declared at the top either as true or false. As this compile time flag is required only for VoyagerOTA platform.
> 2. Firmware uploaded to VoyagerOTA must be built with `__ENABLE_DEVELOPMENT_MODE__` false. Development compiled builds will be rejected by the VoyagerOTA platform.
> 3. The library uses staging and production channels. Production builds first go to the **staging** channel for testing.
> 4. On your local device, you can temporarily set `__ENABLE_DEVELOPMENT_MODE__` true to fetch the **staging** release.
> 5. After testing, promote the release to **production** to make it available to all devices.

## System High Level Architecture Diagram

<p align="center">
  <img src="docs/1.png" width="100%" alt="Architecture Diagram"/>
</p>

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/mediocre9/voyager-ota/blob/main/LICENSE) for details.
