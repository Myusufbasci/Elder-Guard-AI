package com.eldercare.elder.ui.caregiver

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text

/**
 * Lightweight charts drawn directly on a Compose Canvas — no third-party charting
 * dependency (keeps the locked dependency set + avoids extra Maven resolution).
 * Mirrors the web Recharts trio: heart-rate line, steps/sleep bars.
 */

@Composable
fun MetricLineChart(
    values: List<Double>,
    lineColor: Color,
    modifier: Modifier = Modifier,
) {
    if (values.isEmpty()) {
        EmptyChart(modifier)
        return
    }
    val minV = values.min()
    val maxV = values.max()
    val range = (maxV - minV).takeIf { it > 0.0 } ?: 1.0
    Canvas(modifier = modifier.fillMaxWidth().height(160.dp).padding(8.dp)) {
        drawAxes()
        val w = size.width
        val h = size.height
        val stepX = if (values.size > 1) w / (values.size - 1) else 0f
        val path = Path()
        values.forEachIndexed { i, v ->
            val x = i * stepX
            val y = h - ((v - minV) / range).toFloat() * h
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, color = lineColor, style = Stroke(width = 4f))
        // Dots
        values.forEachIndexed { i, v ->
            val x = i * stepX
            val y = h - ((v - minV) / range).toFloat() * h
            drawCircle(color = lineColor, radius = 5f, center = Offset(x, y))
        }
    }
}

@Composable
fun MetricBarChart(
    values: List<Double>,
    barColor: Color,
    modifier: Modifier = Modifier,
) {
    if (values.isEmpty()) {
        EmptyChart(modifier)
        return
    }
    val maxV = values.max().takeIf { it > 0.0 } ?: 1.0
    Canvas(modifier = modifier.fillMaxWidth().height(160.dp).padding(8.dp)) {
        drawAxes()
        val w = size.width
        val h = size.height
        val slot = w / values.size
        val barWidth = slot * 0.6f
        values.forEachIndexed { i, v ->
            val barH = (v / maxV).toFloat() * h
            val x = i * slot + (slot - barWidth) / 2f
            drawRect(
                color = barColor,
                topLeft = Offset(x, h - barH),
                size = androidx.compose.ui.geometry.Size(barWidth, barH),
            )
        }
    }
}

private fun DrawScope.drawAxes() {
    val axisColor = Color(0x33888888)
    drawLine(axisColor, Offset(0f, size.height), Offset(size.width, size.height), strokeWidth = 2f)
    drawLine(axisColor, Offset(0f, 0f), Offset(0f, size.height), strokeWidth = 2f)
}

@Composable
private fun EmptyChart(modifier: Modifier) {
    Column(modifier = modifier.fillMaxWidth().height(160.dp).padding(8.dp)) {
        Spacer(Modifier.height(64.dp))
        Text(
            "Veri yok",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
fun ChartLegendRow(min: Double?, max: Double?, avg: Double?, unit: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        LegendItem("Min", min, unit, Modifier.weight(1f))
        LegendItem("Ort", avg, unit, Modifier.weight(1f))
        LegendItem("Max", max, unit, Modifier.weight(1f))
    }
}

@Composable
private fun LegendItem(label: String, value: Double?, unit: String, modifier: Modifier) {
    Column(modifier = modifier) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(
            value?.let { "${it.toInt()} $unit" } ?: "—",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
