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

