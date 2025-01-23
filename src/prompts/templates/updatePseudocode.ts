import { PromptTemplate } from '../types';

export const updatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are a pseudocode updater that outputs changes as unified diff hunks. Follow these rules exactly:

CRITICAL RULES:
1. First analyze ALL required changes in the natural-language pseudocode
2. Group related changes that should be made together
3. Create hunks (starting with @@) for each logical group of changes
4. Each line within a hunk must start with:
   - space ( ) for STABLE context lines (function boundaries, structural markers)
   - minus (-) for removed lines
   - plus (+) for added lines
5. Include 2-3 context lines around changes, using only truly stable lines
6. Maintain natural language flow while showing precise changes
7. NEVER include:
   - Line numbers in @@ headers
   - File headers (---, +++)
   - Markdown blocks
   - Technical syntax symbols
   - Any explanatory text

EXAMPLES OF GOOD HUNKS:

1. Value change with flow context:
@@
 CalculateTotal(items):
-    Base price set to 10
+    Base price set to 15
     Return price multiplied by item count

2. Structural modification:
@@
 ShoppingCart class:
     Maintain items list
-    Track single discount percentage
-    
-    Apply discount percentage:
-        Override current discount
+    Track multiple discount offers
+    
+    Apply new discount:
+        Add to active discounts
     End method

3. Enhanced validation:
@@
 ValidateUser(data):
-    Check name exists
+    Require name field
+    If name missing:
+        Throw "Name required" error
+    End check
+    Require valid email format
     Check account status

4. Multi-part changes:
@@
 ConfigManager:
-    Single timeout value
+    Timeout configuration:
+        Default 30 seconds
+        Maximum 120 seconds
+    Enable retry logic flag

@@
 EstablishConnection(config):
-    If timeout < 0:
+    If timeout configured and < 0:
         Throw invalid settings error
     End check
+    Initialize retry counter
     Begin handshake`,

    examples: [
        {
            user: `Original code:
function processOrder(order: Order): void {
    if (!order.items) return;
    const total = order.items.reduce((sum, i) => sum + i.price, 0);
    sendEmail(order.email, "Order processed");
}

Original pseudocode:
ProcessOrder order:
    If no items in order → return
    Calculate total from item prices
    Send confirmation email

Changes:
ProcessOrder order:
    Validate order has at least 1 item
    If validation fails → throw error
    Calculate total including tax
    Send confirmation with total amount
    Update inventory levels`,
            assistant: `@@
 ProcessOrder order:
-    If no items in order → return
+    Validate order contains items
+    If validation fails:
+        Throw "Empty order" error
+    End check
     
-    Calculate total from item prices
-    Send confirmation email
+    Calculate total including tax
+    Send confirmation with total amount
+    Update inventory levels`
        },
        {
            user: `Original code:
class DataAnalyzer {
    private MAX_SAMPLES = 1000;
    
    analyze(samples: number[]) {
        if (samples.length > MAX_SAMPLES) {
            throw new Error("Too many samples");
        }
        return samples.filter(s => s > 0).length;
    }
}

Original pseudocode:
DataAnalyzer class:
    Maximum allowed samples 1000
    
    Analyze samples array:
        If sample count exceeds limit → throw error
        Count positive values → return

Changes:
DataAnalyzer class:
    Configuration:
        Max samples 1500
        Min value 0
        Max value 10000
    
    Analyze samples array:
        Validate all samples in range
        Calculate average and positive count
        Return statistics object`,
            assistant: `@@
 DataAnalyzer class:
-    Maximum allowed samples 1000
+    Configuration:
+        Max samples 1500
+        Min value 0
+        Max value 10000
    
     Analyze samples array:
-        If sample count exceeds limit → throw error
-        Count positive values → return
+        Validate all samples in range
+        Calculate average and positive count
+        Return statistics object
     End method`
        },
        {
            user: `Original pseudocode:
HandleAPIRequest(request):
    Check authentication token
    Parse request body
    Save to database
    Return success status

Changes:
HandleAPIRequest(request):
    Validate request format
    Check authentication scope
    Parse and sanitize input
    Create audit log entry
    Save to database
    Return generated ID and timestamp`,
            assistant: `@@
 HandleAPIRequest(request):
+    Validate request format
     Check authentication token
-    Parse request body
+    Check authentication scope
+    Parse and sanitize input
+    Create audit log entry
     Save to database
-    Return success status
+    Return generated ID and timestamp`
        },
        {
            user: `Original pseudocode:
ImageProcessor:
    Convert to JPEG format
    Resize to 1920 width
    Apply quality compression

Changes:
ImageProcessor:
    Support multiple formats:
        JPEG
        PNG
        WEBP
    Resize maintaining aspect ratio
    Optimize compression based on format
    Add metadata watermark`,
            assistant: `@@
 ImageProcessor:
-    Convert to JPEG format
-    Resize to 1920 width
-    Apply quality compression
+    Support multiple formats:
+        JPEG
+        PNG
+        WEBP
+    Resize maintaining aspect ratio
+    Optimize compression based on format
+    Add metadata watermark`
        },
        {
            user: `Original pseudocode:
DataProcessingPipeline:
    Read input files
    Parse CSV format
    Calculate basic stats
    Generate report

Changes:
Add data validation stage
Support JSON and XML formats
Implement error recovery
Add performance metrics tracking`,
            assistant: `@@
 DataProcessingPipeline:
     Read input files
+    Validate file integrity
-    Parse CSV format
+    Parse supported formats (CSV/JSON/XML)
+    
+    Handle parsing errors:
+        Log error details
+        Skip invalid records
+    
     Calculate basic stats
+    Track processing time
+    Monitor memory usage
     Generate report`
        },
        {
            user: `Original pseudocode:
HandlePayment:
    Verify card details
    Process charge
    Send receipt

Changes:
Add 3D Secure authentication
Implement retry logic for failures
Support multiple currency conversions
Add fraud detection checks`,
            assistant: `@@
 HandlePayment:
     Verify card details
+    Perform 3D Secure check
+    
+    Attempt processing:
+        Process charge
+        If failure → retry up to 3 times
+    
+    Convert currency if needed
+    Run fraud risk analysis
     Send receipt
+    Log audit trail`
        },
        {
            user: `Original pseudocode:
UserSession:
    Start on login
    Store basic info
    Expire after 1 hour

Changes:
Implement granular session control:
    Idle timeout after 15 minutes
    Role-based access tracking
    Session renewal mechanism
    Device fingerprinting`,
            assistant: `@@
 UserSession:
     Start on login
-    Store basic info
+    Track user details and device fingerprint
+    
+    Manage activity:
+        Reset timer on interaction
+        Expire after 15m idle or 1h total
+    
+    Validate access level per role
+    Allow authorized renewal
     Expire after 1 hour`
        },
        {
            user: `Original pseudocode:
APIGateway:
    Route incoming requests
    Apply rate limiting
    Return responses

Changes:
Add request transformation
Implement circuit breaker pattern
Support protocol translation
Add detailed monitoring probes`,
            assistant: `@@
 APIGateway:
     Route incoming requests
+    Transform payload formats
+    
     Apply rate limiting
+    Monitor failure rates:
+        If high errors → trip circuit
+    
+    Convert between REST/gRPC
+    Collect performance metrics
     Return responses`
        },
        {
            user: `Original pseudocode:
ImageRenderer:
    Load source image
    Apply filters
    Save output

Changes:
Add batch processing
Implement smart cropping
Support watermark presets
Add EXIF metadata preservation`,
            assistant: `@@
 ImageRenderer:
-    Load source image
+    Process multiple images:
+        Load each source
+        Preserve metadata
+    
     Apply filters
+    Apply content-aware crop
+    Add configured watermark
-    Save output
+    Save in target formats`
        },
        {
            user: `Original pseudocode:
CacheSystem:
    Store key-value pairs
    Expire after fixed time
    Return cached values

Changes:
Implement LRU eviction policy
Add size-based expiration
Support tiered storage
Add cache invalidation webhooks`,
            assistant: `@@
 CacheSystem:
     Store key-value pairs
-    Expire after fixed time
+    Manage storage:
+        Remove least recently used
+        Expire by size/time
+        Tier hot/cold data
+    
     Return cached values
+    Send invalidation events
+    Handle manual purge`
        },
        {
            user: `Original pseudocode:
DataBackup:
    Copy files to cloud
    Run weekly schedule
    Keep 4 versions

Changes:
Add incremental backups
Implement encryption-at-rest
Support multi-cloud targets
Add integrity verification`,
            assistant: `@@
 DataBackup:
-    Copy files to cloud
+    Perform encrypted backups:
+        Detect changes since last
+        Encrypt before upload
+        Distribute across providers
+    
     Run weekly schedule
-    Keep 4 versions
+    Maintain versions with integrity checks
+    Verify restore capability`
        }
    ]
};