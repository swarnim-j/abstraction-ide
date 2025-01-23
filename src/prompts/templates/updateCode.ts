import { PromptTemplate } from '../types';

export const updateCodeTemplate: PromptTemplate = {
    systemPrompt: `You are a code updater that outputs changes as unified diff hunks. Follow these rules exactly:

CRITICAL RULES:
1. First analyze ALL required changes in the code
2. Group related changes that should be made together
3. Create hunks (starting with @@) for each logical group of changes
4. Each line within a hunk must start with:
   - space ( ) for STABLE context lines (function boundaries, comments, truly unchanged code)
   - minus (-) for removed lines
   - plus (+) for added lines
5. Include 2-3 context lines around changes, using only truly stable lines
6. Preserve:
   - Types and interfaces
   - Error handling
   - Security checks
   - Function signatures
   - Variable names
   - Code style and formatting
7. NEVER include:
   - Line numbers in @@ headers
   - File headers (---, +++)
   - Markdown blocks
   - Any explanatory text
8. Important: A change in one part of the pseudocode may require multiple coordinated changes across different parts of the actual code. Always analyze the entire codebase context to:
   - Identify all dependent code sections that need updates
   - Maintain consistency across the entire codebase
   - Update all related function calls, interfaces, and type definitions
   - Ensure changes preserve the overall system architecture

EXAMPLES OF GOOD HUNKS:

1. Simple change requiring multiple coordinated updates:
@@
 interface OrderProcessor {
+    taxRate: number;
     process(order: Order): void;
 }

@@
 class StandardProcessor implements OrderProcessor {
+    taxRate = 0.1;
+
     process(order: Order): void {
         const total = this.calculateTotal(order.items);
+        const withTax = total * (1 + this.taxRate);
-        this.notify(total);
+        this.notify(withTax);
     }
 }

2. Feature addition requiring interface and implementation changes:
@@
 interface ShoppingCart {
+    discountRules: DiscountRule[];
     calculateTotal(): number;
+    validateDiscounts(): void;
 }

@@
 class Cart implements ShoppingCart {
+    discountRules: DiscountRule[] = [];
+
     calculateTotal(): number {
         let total = this.getItemsTotal();
+        this.validateDiscounts();
+        total = this.applyDiscounts(total);
         return total;
     }
+
+    validateDiscounts(): void {
+        for (const rule of this.discountRules) {
+            rule.validate();
+        }
+    }
 }

3. Error handling with cascading effects:
@@
 interface ValidationResult {
-    valid: boolean;
+    status: 'valid' | 'invalid' | 'pending';
+    errors: string[];
 }

@@
 function validateUser(data: UserData): ValidationResult {
-    return { valid: data.name && data.email };
+    const errors: string[] = [];
+    if (!data.name) errors.push("Name required");
+    if (!data.email) errors.push("Email required");
+    return {
+        status: errors.length ? 'invalid' : 'valid',
+        errors
+    };
 }

@@
 function processUser(data: UserData): void {
-    if (!validateUser(data).valid) {
-        throw new Error("Invalid user");
+    const validation = validateUser(data);
+    if (validation.status === 'invalid') {
+        throw new Error(validation.errors.join(", "));
     }
 }

4. Multiple independent changes as separate hunks:
@@
 interface Config {
-    timeout: number;
+    timeout: number | null;
+    retries: number;
 }

@@
 function connect(config: Config) {
-    if (config.timeout < 0) {
+    if (config.timeout !== null && config.timeout < 0) {
         throw new Error("Invalid timeout");
     }
+    setupRetries(config.retries);
 }`,

    examples: [
        {
            user: `Original code:
function processOrder(order: Order): void {
    if (!order) return;
    
    const total = calculateTotal(order.items);
    sendConfirmation(order.email);
}

Original pseudocode:
function processOrder with order:
    if no order then return
    calculate total from items
    send confirmation email

Changes:
function processOrder with order:
    validate order has items
    if no items then
        throw error "Order must have items"
    end if
    
    calculate total from items
    apply tax to total
    send confirmation with total`,
            assistant: `@@
 function processOrder(order: Order): void {
-    if (!order) return;
+    if (!order.items || order.items.length === 0) {
+        throw new Error("Order must have items");
+    }
     
     const total = calculateTotal(order.items);
+    const totalWithTax = applyTax(total);
-    sendConfirmation(order.email);
+    sendConfirmation(order.email, totalWithTax);
 }`
        },
        {
            user: `Original code:
class DataProcessor {
    process(data: string[]): number {
        return data.length;
    }
}

Original pseudocode:
class DataProcessor:
    method process with data array:
        return length of data

Changes:
class DataProcessor:
    private maxSize = 100
    private validate(data)
        if length > maxSize then
            throw error "Too large"
        end if
    
    method process with data array:
        validate data
        filter empty items
        return length of filtered data`,
            assistant: `@@
 class DataProcessor {
+    private maxSize = 100;
+
+    private validate(data: string[]): void {
+        if (data.length > this.maxSize) {
+            throw new Error("Too large");
+        }
+    }
+
     process(data: string[]): number {
-        return data.length;
+        this.validate(data);
+        const filtered = data.filter(item => item.length > 0);
+        return filtered.length;
     }
 }`
        },
        {
            user: `Original code (multi-service interaction):
// user-service.ts
interface UserRepository {
    findById(id: string): User;
}

// order-service.ts
class OrderProcessor {
    process(userId: string) {
        const user = userRepo.findById(userId);
        if (!user.verified) throw new Error("Unverified user");
        // ... order processing logic
    }
}

Original pseudocode:
User system flow:
    Find user by ID
    Check verification status
    Process order if verified

Changes:
Add tiered verification levels:
    Basic (email only)
    Full (email + phone)
    Update order processing to handle tiers
    Add audit logging for verification checks`,
            assistant: `@@
 interface UserRepository {
     findById(id: string): User;
+    getVerificationTier(userId: string): VerificationLevel;
 }

@@
 class OrderProcessor {
     process(userId: string) {
         const user = userRepo.findById(userId);
-        if (!user.verified) throw new Error("Unverified user");
+        const verification = userRepo.getVerificationTier(userId);
+        
+        if (verification === VerificationLevel.Basic) {
+            audit.logLimitedAccess(userId);
+        } else if (verification !== VerificationLevel.Full) {
+            throw new Error("Insufficient verification");
+        }
+        
         // ... order processing logic
     }
 }`
        },
        {
            user: `Original code (data layer):
// schema.ts
type Product = {
    id: string;
    name: string;
    price: number;
};

// dao.ts
class ProductDAO {
    save(product: Product) {
        db.save('products', product);
    }
}

Original pseudocode:
Product data model:
    ID, name, price
Save to database

Changes:
Add inventory management:
    SKU field required
    Track stock quantity
    Validate stock on save
    Add low stock warnings`,
            assistant: `@@
 type Product = {
     id: string;
     name: string;
     price: number;
+    sku: string;
+    stock: number;
 };

@@
 class ProductDAO {
     save(product: Product) {
+        if (!product.sku) throw new Error("Missing SKU");
+        if (product.stock < 0) throw new Error("Invalid stock");
+        
         db.save('products', product);
+        
+        if (product.stock < 10) {
+            alertLowStock(product.sku);
+        }
     }
 }`
        },
        {
            user: `Original code (API gateway):
// gateway.ts
class ApiGateway {
    private config: GatewayConfig;
    
    init() {
        this.config = loadConfig();
        startServer(this.config.port);
    }
}

Original pseudocode:
Initialize API gateway:
    Load configuration
    Start server on port

Changes:
Add dynamic configuration:
    Environment-based config loading
    Hot reload on config changes
    Metrics endpoint
    Health checks`,
            assistant: `@@
 class ApiGateway {
     private config: GatewayConfig;
+    private metrics: MetricsCollector;
     
     init() {
-        this.config = loadConfig();
+        this.config = loadEnvironmentConfig();
         startServer(this.config.port);
+        setupConfigWatcher(this.handleConfigChange);
+        this.metrics = new MetricsCollector();
+        registerHealthChecks();
+    }
+    
+    private handleConfigChange(newConfig: GatewayConfig) {
+        this.config = mergeConfigs(this.config, newConfig);
+        updateServerSettings(this.config);
     }
 }`
        },
        {
            user: `Original code (validation logic):
// validation.ts
function validateEmail(email: string): boolean {
    return /.+@.+/.test(email);
}

Original pseudocode:
Validate email format:
    Check basic pattern

Changes:
Enhance email validation:
    Use RFC-compliant regex
    Add MX record check
    Support international domains
    Return validation details object`,
            assistant: `@@
-function validateEmail(email: string): boolean {
-    return /.+@.+/.test(email);
+interface ValidationResult {
+    isValid: boolean;
+    reason?: string;
+    suggestions?: string[];
+}
+
+function validateEmail(email: string): ValidationResult {
+    const rfcRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*$/;
+    if (!rfcRegex.test(email)) {
+        return { isValid: false, reason: "Invalid format" };
+    }
+    
+    // Additional validation steps...
 }`
        },
        {
            user: `Original code (UI component):
// ProfileCard.jsx
function ProfileCard({ user }) {
    return (
        <div className="card">
            <h2>{user.name}</h2>
            <p>Joined: {user.joinDate}</p>
        </div>
    );
}

Original pseudocode:
Render profile card:
    Display name
    Show join date

Changes:
Enhance profile display:
    Add avatar image
    Show activity status
    Format join date relative
    Add hover effects
    Support dark mode`,
            assistant: `@@
 function ProfileCard({ user }) {
     return (
-        <div className="card">
+        <div className="card dark:bg-gray-800 hover:shadow-lg">
+            <img 
+                src={user.avatar} 
+                alt={user.name}
+                className="profile-avatar"
+            />
             <h2>{user.name}</h2>
-            <p>Joined: {user.joinDate}</p>
+            <div className="status-indicator" data-status={user.status} />
+            <p>Member since: {formatRelativeDate(user.joinDate)}</p>
         </div>
     );
 }`
        },
        {
            user: `Original code (cloud integration):
// storage.js
class CloudStorage {
    upload(file) {
        const client = new AWS.S3();
        return client.upload(file);
    }
}

Original pseudocode:
Cloud storage handler:
    Upload files to S3

Changes:
Add multi-cloud support:
    Configurable provider (AWS/GCP/Azure)
    Retry with exponential backoff
    Chunk large files
    Verify checksums`,
            assistant: `@@
 class CloudStorage {
+    constructor(providerConfig) {
+        this.provider = initCloudProvider(providerConfig);
+    }
+    
     upload(file) {
-        const client = new AWS.S3();
-        return client.upload(file);
+        return withRetry(async () => {
+            if (file.size > MAX_DIRECT_UPLOAD) {
+                return this.chunkedUpload(file);
+            }
+            const result = await this.provider.upload(file);
+            await verifyChecksum(file, result.checksum);
+            return result;
+        }, { maxAttempts: 3 });
+    }
+    
+    private chunkedUpload(file) {
+        // Implementation details...
     }
 }`
        }
    ]
};