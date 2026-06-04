<p align="center">
    <h1 align="center">
        VoyagerOTA
    </h1>
    <h3 align="center">
        Firmware OTA Release Distribution Platform
    </h3>
    <p align="center">
    &nbsp;
    <a href="#"><img src="https://img.shields.io/badge/Platform-Backend-orange"></a>
    &nbsp;
    <a href="https://github.com/mediocre9/VoyagerOTAClient"><img src="https://img.shields.io/badge/SDK-VoyagerOTAClient-green"></a>
        &nbsp;
    <a href="#"><img src="https://img.shields.io/badge/MCU-ESP32-purple"></a>
    <a href="https://github.com/mediocre9/voyager-ota/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue"></a>
    </p>
</p>

## What is VoyagerOTA?

> VoyagerOTA is a backend platform for managing and distributing firmware updates over-the-air (OTA). It is designed for developers working with embedded devices especially the esp32, providing a structured way to handle firmware releases using monotonic semantic versioning.

## Features

- [x] Monotonically increasing semantic versioning.
- [x] Artifact build hash collision prevention across releases.
- [x] Staging channel for production builds.
- [x] Production release revocation support.
- [x] Project Restoration support.

## Planned Features

- [ ] Device update reporting

## Quickstart

> [!NOTE]
> Create a `.env.development` file in the root before running the server.

```env
npm install

# then run server in development mode....
npm run dev

# run each of them separately.....
npm run artifact-worker
npm run storage-worker
npm run outbox-relay
npm run orphan-cron
npm run purger-cron
```

## Authentication & Project Setup

1. Sign up.
2. Create a project.
3. Get `projectId` and `apiKey`.
4. Use the credentials in sdk.

## Client Side Device Integration

> [!TIP]
> Use the official client sdk library [**VoyagerOTAClient**](https://github.com/mediocre9/VoyagerOTAClient) to handle OTA updates on ESP32 devices.

```cpp
#define __USE_STAGING_CHANNEL__ true
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
> 1. The `__USE_STAGING_CHANNEL__` must be declared at the top either as true or false. As this compile time flag is required only for VoyagerOTA platform.
> 2. Firmware uploaded must be built with `__USE_STAGING_CHANNEL__` false. Development compiled builds will be rejected by backend.
> 3. The library uses staging and production channels. Production builds first go to the **staging** channel for testing.
> 4. On your local device, you can temporarily set `__USE_STAGING_CHANNEL__` true to fetch the **production** release from staging channel.
> 5. After testing, promote the release to **production** to make it available to all devices.

## Architecture

- `ArtifactInspectionQueue` and `StorageManagerQueue` handle artifact processing and storage related operations asynchronously.
- Outbox pattern is used for project deletion and restoration to keep database and file storage consistent.
- Redis caching is used for the latest release endpoint with simple mutex lock is used to prevent cache stampede.
- `OrphanFileCronJob` deletes soft-deleted records older than 3 months.
- `PurgingCronJob` deletes orphan files not referenced in the database.

### System High Level Architecture Diagram

<p align="center">
  <img src="docs/1.png" width="100%" alt="Architecture Diagram"/>
</p>

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/mediocre9/voyager-ota/blob/main/LICENSE) for details.
