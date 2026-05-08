package com.eldercare.elder.di

import android.content.Context
import com.eldercare.elder.BuildConfig
import com.eldercare.elder.data.HealthConnectManager
import com.eldercare.elder.data.LocationManager
import com.eldercare.elder.data.SyncTokenStore
import com.eldercare.elder.data.TokenStore
import com.eldercare.elder.network.AuthInterceptor
import com.eldercare.elder.network.BaseUrl
import com.eldercare.elder.network.EldercareApi
import com.eldercare.elder.network.RefreshAuthenticator
import com.eldercare.elder.sync.WorkManagerScheduler
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideBaseUrl(): BaseUrl = BaseUrl(
        // Override at build time via gradle property if needed.
        if (BuildConfig.DEBUG) "https://holders-toilet-she-perceived.trycloudflare.com/" else "https://api.eldercare.example/"
    )

    @Provides
    @Singleton
    fun provideMoshi(): Moshi = Moshi.Builder()
        .add(KotlinJsonAdapterFactory())
        .build()

    @Provides
    @Singleton
    fun provideOkHttp(
        authInterceptor: AuthInterceptor,
        refreshAuthenticator: RefreshAuthenticator,
    ): OkHttpClient {
        val log = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
            else HttpLoggingInterceptor.Level.NONE
        }
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(log)
            .authenticator(refreshAuthenticator)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, moshi: Moshi, baseUrl: BaseUrl): Retrofit =
        Retrofit.Builder()
            .baseUrl(baseUrl.value)
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides
    @Singleton
    fun provideApi(retrofit: Retrofit): EldercareApi = retrofit.create(EldercareApi::class.java)

    @Provides
    @Singleton
    fun provideTokenStore(@ApplicationContext context: Context): TokenStore = TokenStore(context)

    @Provides
    @Singleton
    fun provideSyncTokenStore(@ApplicationContext context: Context): SyncTokenStore =
        SyncTokenStore(context)

    @Provides
    @Singleton
    fun provideHealthConnectManager(@ApplicationContext context: Context): HealthConnectManager =
        HealthConnectManager(context)

    @Provides
    @Singleton
    fun provideLocationManager(@ApplicationContext context: Context): LocationManager =
        LocationManager(context)

    @Provides
    @Singleton
    fun provideWorkScheduler(@ApplicationContext context: Context): WorkManagerScheduler =
        WorkManagerScheduler(context)
}
