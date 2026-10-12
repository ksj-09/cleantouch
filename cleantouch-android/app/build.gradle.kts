plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "kr.cleantouch.scan"
    compileSdk = 36

    defaultConfig {
        applicationId = "kr.cleantouch.scan"
        minSdk = 26
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        versionCode = 22
        versionName = "0.4.8"
        val chatUrl = providers.gradleProperty("CLEANTOUCH_CHAT_URL").orElse("https://cleantouch-place-ai-20261006.netlify.app")
        buildConfigField("String", "PLACE_CHAT_URL", "\"${chatUrl.get()}\"")
        ndk {
            abiFilters += if (providers.gradleProperty("CLEANTOUCH_EMULATOR").isPresent) listOf("x86_64") else listOf("arm64-v8a", "armeabi-v7a")
        }

    }

    buildTypes {
        debug {
            isDebuggable = providers.gradleProperty("CLEANTOUCH_TESTING").isPresent
            isMinifyEnabled = !providers.gradleProperty("CLEANTOUCH_TESTING").isPresent
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            val debugApi = providers.gradleProperty("CLEANTOUCH_DEBUG_API_URL").orElse("http://10.0.2.2:8790")
            buildConfigField("String", "SCAN_API_URL", "\"${debugApi.get()}\"")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        release {
            isMinifyEnabled = true
            val productionApi = providers.gradleProperty("CLEANTOUCH_API_URL").orElse("https://api.cleantouch.kr")
            buildConfigField("String", "SCAN_API_URL", "\"${productionApi.get()}\"")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Compose 1.12 requires API 37 and AGP 9.1+. Keep the production build on
    // the API 36 toolchain until targetSdk 37 rollout and device validation.
    val composeBom = platform("androidx.compose:compose-bom:2025.08.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("com.google.mediapipe:tasks-vision:1.0.0")
    implementation("org.opencv:opencv:4.13.0")
    implementation("com.google.mlkit:text-recognition-korean:16.0.1")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
}
