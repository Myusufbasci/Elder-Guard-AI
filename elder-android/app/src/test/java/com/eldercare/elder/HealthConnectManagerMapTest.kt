package com.eldercare.elder

import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.Metadata
import com.eldercare.elder.data.HealthConnectManager
import io.mockk.mockk
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant
import java.time.ZoneOffset

class HealthConnectManagerMapTest {

    private val manager = HealthConnectManager(mockk(relaxed = true))

    @Test
    fun `HeartRateRecord maps each sample to a heart_rate telemetry sample`() {
        val start = Instant.parse("2026-04-30T10:00:00Z")
        val record = HeartRateRecord(
            startTime = start,
            startZoneOffset = ZoneOffset.UTC,
            endTime = start.plusSeconds(120),
            endZoneOffset = ZoneOffset.UTC,
            samples = listOf(
                HeartRateRecord.Sample(start, 72L),
                HeartRateRecord.Sample(start.plusSeconds(60), 75L),
            ),
            metadata = Metadata.manualEntry(),
        )

        val mapped = manager.mapRecord(record)

        assertEquals(2, mapped.size)
        assertEquals("heart_rate", mapped[0].metric)
        assertEquals(72.0, mapped[0].value, 0.0)
        assertEquals(75.0, mapped[1].value, 0.0)
        assertNull(mapped[0].quality)
    }

    @Test
    fun `StepsRecord maps to a single steps telemetry sample at endTime`() {
        val start = Instant.parse("2026-04-30T10:00:00Z")
        val end = start.plusSeconds(3600)
        val record = StepsRecord(
            startTime = start,
            startZoneOffset = ZoneOffset.UTC,
            endTime = end,
            endZoneOffset = ZoneOffset.UTC,
            count = 4321L,
            metadata = Metadata.manualEntry(),
        )

        val mapped = manager.mapRecord(record)

        assertEquals(1, mapped.size)
        assertEquals("steps", mapped[0].metric)
        assertEquals(4321.0, mapped[0].value, 0.0)
        assertEquals(end.toString(), mapped[0].time)
    }
}
