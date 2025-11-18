output "project_id" {
  description = "Google Cloud Project ID"
  value       = var.project_id
}

output "region" {
  description = "Google Cloud region"
  value       = var.region
}

output "apis_enabled" {
  description = "List of enabled APIs"
  value = [
    google_project_service.vertex_ai.service,
    google_project_service.pubsub.service,
    google_project_service.bigquery.service,
    google_project_service.cloud_run.service,
  ]
}

output "pubsub_topic_name" {
  description = "Pub/Sub topic name for LLM telemetry"
  value       = google_pubsub_topic.llm_telemetry.name
}

output "pubsub_topic_id" {
  description = "Pub/Sub topic ID"
  value       = google_pubsub_topic.llm_telemetry.id
}

output "bigquery_dataset_id" {
  description = "BigQuery dataset ID for telemetry"
  value       = google_bigquery_dataset.telemetry.dataset_id
}

output "bigquery_table_id" {
  description = "BigQuery table ID for telemetry events"
  value       = google_bigquery_table.telemetry_events.table_id
}

