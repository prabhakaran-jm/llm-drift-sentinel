# Bootstrap Terraform Backend

Creates the GCS bucket for storing Terraform state remotely.

## One-time Setup

1. Configure variables:
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id and unique bucket name
```

**Important**: The bucket name must be globally unique across all GCS buckets.

2. Initialize and apply:
```bash
terraform init
terraform plan
terraform apply
```

3. Note the bucket name from outputs:
```bash
terraform output backend_bucket_name
```

4. Use this bucket name in `../terraform.tfvars` for the main Terraform config.

## Cleanup

To destroy the backend bucket:
```bash
terraform destroy
```

**Warning**: This will delete your Terraform state! Only do this if you're sure.

