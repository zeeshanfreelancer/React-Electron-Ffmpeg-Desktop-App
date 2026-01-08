# 📦 Git LFS Setup Guide - Pushing Your Code to GitHub

This guide explains how to push your Slideshow Generator project to GitHub with Git LFS for large files.

## Prerequisites

1. **Git installed** with Git LFS support
2. **GitHub account** (free tier works, but has LFS limits)
3. **Repository created** on GitHub (empty or with README)

---

## Step-by-Step: Initial Push with Git LFS

### Step 1: Install and Initialize Git LFS

```bash
# Check if Git LFS is installed
git lfs version

# If not installed, download from: https://git-lfs.github.com/
# Then initialize Git LFS (one-time setup)
git lfs install
```

**Expected output:**
```
Git LFS initialized.
```

### Step 2: Navigate to Your Project

```bash
cd "C:\Users\zeesh\Desktop\Development\Personal Projects\slideshow-generator"
```

### Step 3: Initialize Git Repository (if not already done)

```bash
# Check if git is initialized
git status

# If not initialized, run:
git init
```

### Step 4: Configure Git LFS Tracking

The `.gitattributes` file is already created and configured. Verify it exists:

```bash
# Check .gitattributes file
cat .gitattributes
# or on Windows:
type .gitattributes
```

**What's tracked by LFS:**
- `xtts/models/**/*.pth` - Model files (~1.5GB)
- `xtts/bin/**/*.exe` - Executables
- `xtts/bin/**/*.dll` - DLL files
- Other large binaries

### Step 5: Add Files to Git

```bash
# Add all files (Git LFS will automatically handle large files)
git add .

# Verify which files are tracked by LFS
git lfs ls-files
```

**Expected output:**
```
Should show files like:
- xtts/models/tts/.../model.pth
- xtts/bin/xtts-server.exe
- etc.
```

### Step 6: Commit Files

```bash
git commit -m "Initial commit: Slideshow Generator with XTTS support"
```

**Note**: This commit may take a while if you have large files. Git LFS will upload them separately.

### Step 7: Add Remote Repository

```bash
# Replace <your-username> and <repo-name> with your actual values
git remote add origin https://github.com/<your-username>/<repo-name>.git

# Verify remote
git remote -v
```

### Step 8: Push to GitHub

```bash
# Push to GitHub (this will upload LFS files)
git push -u origin main

# Or if your default branch is 'master':
git push -u origin master
```

**Important Notes:**
- **First push may take 30-60 minutes** depending on:
  - Your internet speed
  - Size of XTTS models (~1.5GB)
  - Size of executables (~500MB-1GB)
- **GitHub Free Tier LFS Limits:**
  - Storage: 1GB
  - Bandwidth: 1GB/month
  - If you exceed, consider:
    - Using GitHub Pro (paid)
    - Hosting large files elsewhere
    - Using Git LFS with self-hosted server

**Expected output:**
```
Uploading LFS objects: 100% (X/X), X MB | X MB/s
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
...
To https://github.com/username/repo.git
 * [new branch]      main -> main
```

---

## Verifying LFS Files Were Pushed

### Check on GitHub

1. Go to your repository on GitHub
2. Navigate to `xtts/models/` or `xtts/bin/`
3. Files tracked by LFS will show:
   - File size (e.g., "1.5 GB")
   - "Stored with Git LFS" badge
   - Pointer file content when viewed

### Check Locally

```bash
# List all LFS-tracked files
git lfs ls-files

# Check LFS status
git lfs status
```

---

## Updating Your Repository

### Making Changes and Pushing Updates

```bash
# Make your changes to code files
# ...

# Stage changes
git add .

# Commit
git commit -m "Description of changes"

# Push (LFS files are automatically handled)
git push
```

**Note**: If you modify large files (models, executables), Git LFS will upload new versions.

---

## Important: Files Included vs Excluded

### ✅ Files INCLUDED (Tracked):

**Source Code:**
- `main/**` - All Electron main process code
- `client/src/**` - All React frontend code
- `xtts/server/**/*.py` - Python source files
- `xtts/server/requirements.txt` - Python dependencies
- `xtts/server/xtts-server.spec` - PyInstaller spec

**Configuration:**
- `package.json` (root and client)
- `package-lock.json` (root and client)
- `.gitattributes` - LFS configuration
- `.gitignore` - Ignore rules
- All `.md` documentation files

**Large Files (via LFS):**
- `xtts/models/**/*.pth` - Model files
- `xtts/bin/**/*.exe` - Executables
- `xtts/bin/**/*.dll` - DLL files

**Small Files:**
- `xtts/voices/**/*.mp3` - Voice samples (small, tracked normally)
- `xtts/README.md` - Documentation

### ❌ Files EXCLUDED (Not Tracked):

- `node_modules/` - Dependencies (installed via `npm install`)
- `client/node_modules/` - Client dependencies
- `dist/` - Build outputs
- `client/dist/` - Client build outputs
- `xtts/server/.venv/` - Python virtual environment
- `xtts/server/build/` - PyInstaller build artifacts
- `xtts/server/__pycache__/` - Python cache
- `video-temp/` - Temporary video files
- `*.log` - Log files

---

## Troubleshooting

### Problem: "git-lfs: command not found"

**Solution:**
1. Download Git LFS from: https://git-lfs.github.com/
2. Install it
3. Run: `git lfs install`

### Problem: LFS files not being tracked

**Solution:**
```bash
# Ensure .gitattributes exists and is committed
git add .gitattributes
git commit -m "Add Git LFS configuration"

# Re-add files
git add .
git commit -m "Add files with LFS"
```

### Problem: "Git LFS quota exceeded"

**GitHub Free Tier Limits:**
- Storage: 1GB
- Bandwidth: 1GB/month

**Solutions:**
1. **Wait for monthly reset** (bandwidth resets monthly)
2. **Upgrade to GitHub Pro** ($4/month) - 50GB storage, 50GB bandwidth
3. **Use alternative storage:**
   - Self-hosted Git LFS server
   - External file hosting (AWS S3, etc.)
   - Manual download instructions in SETUP.md

### Problem: Push fails with "LFS upload failed"

**Possible causes:**
- Network timeout
- GitHub LFS quota exceeded
- Authentication issues

**Solutions:**
```bash
# Check LFS status
git lfs status

# Retry push
git push

# If quota exceeded, see above solutions
```

### Problem: Files show as "pointer" files on GitHub

**This is normal!** LFS-tracked files show as pointer files on GitHub web interface. When someone clones the repo and runs `git lfs pull`, they get the actual files.

**To verify files are actually stored:**
```bash
# Check locally
git lfs ls-files

# Files should show actual sizes, not pointer sizes
```

### Problem: Repository size is still large

**Check what's taking space:**
```bash
# Check repository size
du -sh .git

# Check LFS files
git lfs ls-files | wc -l

# If non-LFS files are large, check .gitignore
git check-ignore -v <large-file>
```

---

## Best Practices

### 1. Commit .gitattributes First

```bash
git add .gitattributes
git commit -m "Configure Git LFS"
```

### 2. Test LFS Before Major Push

```bash
# Add a test file
git add .
git lfs ls-files  # Verify LFS tracking
git commit -m "Test commit"
git push          # Test push
```

### 3. Monitor LFS Usage

```bash
# Check LFS file count and sizes
git lfs ls-files | wc -l
git lfs ls-files -l  # Show file sizes
```

### 4. Document LFS Requirements

- Include Git LFS installation in SETUP.md (already done)
- Mention LFS in README.md
- Add note about GitHub LFS limits

---

## Alternative: Excluding Large Files

If you prefer NOT to include large files in the repository:

### Option 1: Manual Download Instructions

1. Keep large files out of Git
2. Provide download links in SETUP.md
3. Users download models/executables manually

### Option 2: Separate Releases

1. Keep code in main repository
2. Create GitHub Releases with large files as assets
3. Users download releases separately

### Option 3: External Hosting

1. Host large files on AWS S3, Google Drive, etc.
2. Provide download scripts in SETUP.md
3. Users download during setup

---

## Summary Checklist

Before pushing to GitHub:

- [ ] Git LFS installed and initialized (`git lfs install`)
- [ ] `.gitattributes` file exists and is correct
- [ ] `.gitignore` file excludes unnecessary files
- [ ] All source code files are ready
- [ ] Large files (models, executables) are in place
- [ ] `SETUP.md` created with setup instructions
- [ ] Repository created on GitHub
- [ ] Remote added (`git remote add origin ...`)
- [ ] Files added and committed
- [ ] Test push completed successfully
- [ ] Verified LFS files are tracked correctly

---

## Next Steps After Pushing

1. **Update README.md** with:
   - Project description
   - Link to SETUP.md
   - Note about Git LFS requirements

2. **Create GitHub Releases** (optional):
   - Tag versions: `git tag v1.0.0`
   - Push tags: `git push --tags`
   - Create release on GitHub with release notes

3. **Set Up CI/CD** (optional):
   - GitHub Actions for automated builds
   - Automated testing

4. **Documentation**:
   - Ensure SETUP.md is comprehensive
   - Add screenshots if helpful
   - Document API/features

---

## Quick Reference Commands

```bash
# Initialize Git LFS
git lfs install

# Track files (already in .gitattributes)
git add .gitattributes
git commit -m "Add LFS config"

# Add all files
git add .

# Check LFS-tracked files
git lfs ls-files

# Commit
git commit -m "Initial commit"

# Add remote
git remote add origin <repo-url>

# Push
git push -u origin main

# Check LFS status
git lfs status

# Pull LFS files (for users cloning)
git lfs pull
```

---

**Last Updated**: 2024
**Version**: 1.0.0


