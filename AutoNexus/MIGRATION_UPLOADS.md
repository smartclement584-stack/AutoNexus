# Image Upload Storage Migration Guide

## Launch Decision (confirmed)

**For this launch, we are staying on `STORAGE_BACKEND=local`.** The backend
runs on a VPS/droplet with a persistent disk, so the "ephemeral filesystem"
risk that motivated the earlier S3 write-up below does not apply. **Do not
migrate to S3 for this launch** — the S3 backend exists and is tested, but
switching to it is a deliberate future decision, not something to do now.

### Where uploads actually live at runtime

`UPLOAD_DIR` is computed in `backend/server.py` as:
```python
ROOT_DIR = Path(__file__).parent   # directory containing server.py
UPLOAD_DIR = ROOT_DIR / "uploads"
```

This means the absolute path is **wherever you deploy the `backend/`
directory on the VPS**, plus `/uploads`. For example, if the repo is cloned
to `/home/deploy/AutoNexus`, the resolved path is:
```
/home/deploy/AutoNexus/backend/uploads
```

**Action required before go-live:** confirm that whatever path you deploy
`backend/` to on the VPS is on the persistent disk (not a tmpfs mount, not
inside a container layer that gets discarded on rebuild, if this is ever
containerized later). Run this on the VPS after deploying to get the exact
real path:
```bash
cd /path/to/deployed/backend
python3 -c "from pathlib import Path; print((Path.cwd() / 'uploads').resolve())"
```
Whatever path that prints is the one that must survive redeploys, reboots,
and (if it ever happens) containerization.

### Backup the uploads directory (manual — schedule this yourself)

A persistent disk is not a backup. If the VPS itself is ever lost,
reimaged, or has a disk failure, `backend/uploads/` and everything in it is
gone. Schedule ONE of the following as a cron job on the VPS. Neither is
built or automated by this codebase — you need to add the cron entry
yourself (`crontab -e`).

**Option A — nightly `tar` archive to a second local path or attached
backup volume** (simplest, good if you have a second disk/volume attached):
```bash
# Runs at 2:00 AM daily. Adjust SRC and DEST for your actual deploy path.
0 2 * * * tar -czf /var/backups/autonexus-uploads-$(date +\%Y\%m\%d).tar.gz -C /path/to/deployed/backend uploads && find /var/backups -name 'autonexus-uploads-*.tar.gz' -mtime +14 -delete
```
This keeps 14 days of nightly archives and prunes older ones automatically.

**Option B — nightly `rsync` to a remote host** (better if you have a
second server, or want off-VPS redundancy — recommended over Option A if
available, since it survives total loss of the VPS itself):
```bash
# Runs at 2:00 AM daily. Requires passwordless SSH key auth to BACKUP_HOST set up in advance.
0 2 * * * rsync -avz --delete /path/to/deployed/backend/uploads/ user@BACKUP_HOST:/backups/autonexus-uploads/
```
`--delete` keeps the remote copy in sync with what currently exists (i.e.
it's a mirror, not an incrementally growing archive). Drop `--delete` if
you'd rather keep everything that was ever uploaded, including files later
removed.

Either option is sufficient for launch. Option B is the stronger choice if
you have anywhere else to send the backup to, since Option A alone still
leaves you exposed if the VPS's own disk fails entirely (the tar files
would be lost along with the uploads they're backing up).

## Current State
- 4 image files exist in `backend/uploads/` (as of July 2025)
- Images are referenced in the database by their `/uploads/filename.ext` paths

## Storage Backend Changes

The upload system has been refactored to support multiple storage backends:

### Local Filesystem (in use for this launch)
- **Configuration:** `STORAGE_BACKEND=local` (default in `.env`, and the
  code's fallback if the env var is missing entirely — see "Launch
  Decision" above)
- **Location:** `backend/uploads/` directory
- **Use case:** Local development, and — as of this launch — the VPS
  production deployment, since it has a persistent disk
- **Persistence:** Depends on filesystem persistence (ephemeral only if
  ever moved to a redeploy target without a persistent volume, e.g. a
  future containerized/PaaS deployment)

### S3-Compatible Storage (available, not in use — future option)
- **Configuration:** `STORAGE_BACKEND=s3`
- **Supported services:**
  - AWS S3 (set `S3_ENDPOINT=` empty)
  - Backblaze B2 (set `S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com` or your region)
  - Cloudflare R2 (set appropriate endpoint)
  - Any S3-compatible service
- **Configuration variables:**
  - `S3_BUCKET` - bucket name (required)
  - `S3_REGION` - AWS region or service region (default: us-east-1)
  - `S3_ENDPOINT` - custom endpoint URL (optional, leave empty for AWS S3)
  - `S3_ACCESS_KEY` - access key ID (required)
  - `S3_SECRET_KEY` - secret access key (required)

## Migration Steps (Existing Files)

### Option 1: Keep Local Storage (No Migration Needed)
If deploying to a single machine with persistent storage:
1. Leave `STORAGE_BACKEND=local` in `.env`
2. Ensure the `backend/uploads/` directory is persisted across redeploys
3. No changes needed to existing images or database records
4. **Caveat:** Images will be lost on container restarts/redeploys without a persistent volume

### Option 2: Migrate to S3-Compatible Storage (Recommended)
1. **Set up S3-compatible storage account** (e.g., Backblaze B2, AWS S3)
2. **Create a new bucket** for images
3. **Generate access credentials** (access key + secret)
4. **Update `.env`:**
   ```
   STORAGE_BACKEND=s3
   S3_BUCKET=your-bucket-name
   S3_REGION=us-east-1
   S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com  # if using Backblaze B2, etc.
   S3_ACCESS_KEY=your-access-key
   S3_SECRET_KEY=your-secret-key
   ```
5. **Migrate existing 4 images** (manual or scripted):
   ```bash
   # Option A: Manual - upload the 4 files from backend/uploads/ via S3 console
   # Option B: Script it
   
   # Python script to migrate existing files:
   import boto3
   from pathlib import Path
   
   s3 = boto3.client('s3',
       region_name='us-east-1',
       aws_access_key_id='YOUR_KEY',
       aws_secret_access_key='YOUR_SECRET'
   )
   
   for file in Path('backend/uploads').glob('*'):
       s3.upload_file(str(file), 'your-bucket-name', file.name)
       print(f"Uploaded {file.name}")
   ```
6. **Update database records** if URL format changes:
   - Old format (local): `/uploads/filename.ext`
   - New format (S3): `/your-bucket-name/filename.ext`
   - Query MongoDB and update all part/seller documents with `image` fields

7. **Test uploads** via the `/api/upload/image` endpoint
8. **Clean up** old `backend/uploads/` directory once migration is verified

## URL Format Changes

### Local Storage Response
```json
{"url": "/uploads/3ebdc14f-9398-4c7d-ba87-8681c10fd33f.webp", "filename": "3ebdc14f-9398-4c7d-ba87-8681c10fd33f.webp"}
```

### S3 Storage Response
```json
{"url": "/your-bucket-name/3ebdc14f-9398-4c7d-ba87-8681c10fd33f.webp", "filename": "3ebdc14f-9398-4c7d-ba87-8681c10fd33f.webp"}
```

**Frontend note:** The frontend already handles both URL formats correctly via the response `url` field. No frontend changes are required.

## Security & Compliance

- **Content validation:** All uploads are still validated via file signature sniffing (magic bytes)
- **Size limits:** 5MB limit still enforced
- **File types:** JPEG, PNG, WebP only
- **Filename safety:** UUIDs used for all filenames, no client-supplied names
- **Access control:** Uploads require authentication (`get_current_user`)

## Rollback

If you need to rollback from S3 to local storage:
1. Set `STORAGE_BACKEND=local` in `.env`
2. Download all images from S3 bucket
3. Place them in `backend/uploads/` directory
4. Ensure URLs match the local format (`/uploads/filename.ext`)
5. Restart the backend

## Questions or Issues

- S3 connection issues? Check credentials and endpoint URL
- Images not persisting? Verify persistent volume is mounted (if using containers)
- URL not working? Verify bucket is public or check S3/frontend URL generation
