// Response shape from the telemetry ingest endpoint. Wrapped by the global
// TransformInterceptor into the standard `{ data, meta }` envelope.
export interface IngestResultDto {
  inserted: number;
}
