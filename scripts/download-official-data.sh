#!/bin/bash
set -euo pipefail

# Script to download official pincode data from data.gov.in
# Handles chunked downloads with retry logic and error handling

# Configuration
# Full URL from government website - extract components from it
FULL_URL="${FULL_URL:-https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd?api-key=579b464db66ec23bdd000001cdc3b564546246a772a26393094f5645&format=json}"

# Extract base URL and API key from FULL_URL
BASE_URL=$(echo "$FULL_URL" | sed 's/\?.*$//')
API_KEY=$(echo "$FULL_URL" | grep -oP 'api-key=\K[^&]+')

CHUNK_SIZE=10000
TOTAL_RECORDS=165627
MAX_RETRIES=3
TIMEOUT=300
OUTPUT_DIR="./data-downloads"
OUTPUT_FILE="official-pincode-data.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first (sudo apt install jq)"
        exit 1
    fi
    
    log_success "All dependencies found"
}

# Create output directory
setup_output_dir() {
    log_info "Setting up output directory: ${OUTPUT_DIR}"
    mkdir -p "${OUTPUT_DIR}"
    cd "${OUTPUT_DIR}"
}

# Download a single chunk with retry logic
download_chunk() {
    local offset=$1
    local chunk_num=$2
    local chunk_file="chunk_${chunk_num}.json"
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log_info "Downloading chunk ${chunk_num} (offset ${offset}, attempt ${attempt}/${MAX_RETRIES})..."
        
        if curl -L --retry 2 --retry-delay 2 --max-time ${TIMEOUT} --fail \
            "${BASE_URL}?api-key=${API_KEY}&offset=${offset}&limit=${CHUNK_SIZE}&format=json" \
            -o "${chunk_file}" --progress-bar 2>&1; then
            
            # Verify the downloaded file is valid JSON
            if jq empty "${chunk_file}" 2>/dev/null; then
                local record_count=$(jq '.records | length' "${chunk_file}")
                log_success "Chunk ${chunk_num} downloaded successfully (${record_count} records)"
                return 0
            else
                log_warn "Chunk ${chunk_num} is not valid JSON, retrying..."
                rm -f "${chunk_file}"
            fi
        else
            log_warn "Download failed for chunk ${chunk_num}, retrying..."
        fi
        
        attempt=$((attempt + 1))
        sleep 3
    done
    
    log_error "Failed to download chunk ${chunk_num} after ${MAX_RETRIES} attempts"
    return 1
}

# Download all chunks
download_all_chunks() {
    local num_chunks=$(( (TOTAL_RECORDS + CHUNK_SIZE - 1) / CHUNK_SIZE ))
    log_info "Total chunks to download: ${num_chunks}"
    
    local failed_chunks=()
    
    for i in $(seq 0 $((num_chunks - 1))); do
        local offset=$((i * CHUNK_SIZE))
        
        if ! download_chunk $offset $i; then
            failed_chunks+=($i)
        fi
        
        # Rate limiting - be nice to the API
        if [ $i -lt $((num_chunks - 1)) ]; then
            sleep 2
        fi
    done
    
    if [ ${#failed_chunks[@]} -gt 0 ]; then
        log_error "Failed to download ${#failed_chunks[@]} chunks: ${failed_chunks[*]}"
        return 1
    fi
    
    log_success "All chunks downloaded successfully"
    return 0
}

# Merge all chunks into a single JSON file
merge_chunks() {
    log_info "Merging chunks into ${OUTPUT_FILE}..."
    
    if ! jq -s 'map(.records) | add' chunk_*.json > "${OUTPUT_FILE}"; then
        log_error "Failed to merge chunks"
        return 1
    fi
    
    local total_records=$(jq '. | length' "${OUTPUT_FILE}")
    log_success "Merged ${total_records} total records into ${OUTPUT_FILE}"
    
    # Cleanup chunk files
    log_info "Cleaning up chunk files..."
    rm -f chunk_*.json
    log_success "Cleanup complete"
}

# Main execution
main() {
    log_info "Starting official pincode data download"
    log_info "Base URL: ${BASE_URL}"
    log_info "API Key: ${API_KEY:0:20}..."
    log_info "Expected records: ${TOTAL_RECORDS}"
    log_info "Chunk size: ${CHUNK_SIZE}"

    check_dependencies
    setup_output_dir
    
    if ! download_all_chunks; then
        log_error "Download failed. Chunk files are preserved in ${OUTPUT_DIR} for inspection."
        exit 1
    fi
    
    if ! merge_chunks; then
        log_error "Merge failed. Chunk files are preserved in ${OUTPUT_DIR} for inspection."
        exit 1
    fi
    
    log_success "Download complete! File saved to: ${OUTPUT_DIR}/${OUTPUT_FILE}"
    log_info "File size: $(du -h "${OUTPUT_FILE}" | cut -f1)"
}

# Run main function
main "$@"
