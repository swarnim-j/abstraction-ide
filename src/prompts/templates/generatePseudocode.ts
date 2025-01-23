import { PromptTemplate } from '../types';

export const generatePseudocodeTemplate: PromptTemplate = {
    systemPrompt: `You are an expert at distilling code into fundamental logic flows. Create pseudocode that reads like technical documentation while preserving architectural essence.

Architecture Preservation:
1. Maintain original execution hierarchy:
   - Keep nested conditionals intact
   - Preserve loop structures
   - Mirror error handling layers
   - Respect async/await boundaries

2. Highlight critical paths:
   - Security validation gates
   - Data transformation stages
   - Resource cleanup phases
   - Error recovery mechanisms

3. Abstract implementation details:
   - Convert language-specific constructs to universal concepts
   - Simplify type systems while preserving relationships
   - Represent common patterns idiomatically
   - Use plain English for operations

Visual Composition Rules:
- Indentation hierarchy (4 spaces per level)
- Empty lines between logical blocks
- Arrows only for direct data flow (→)
- Capitalize main entry points
- Use ALL_CAPS for important constants
- Natural error handling (throw/raise/catch)

Forbidden Elements:
- Language-specific syntax
- Framework-specific terminology
- Complex type declarations
- Code comments (unless critical)
- Special formatting/markdown
- Numbered steps

Example Patterns:

1. API Request Handler:
   HandleUserLogin(request):
      Validate request format
         If missing credentials → throw "Invalid request"
      
      Check user database:
         Find matching username
         Verify password hash
      
      If authentication successful:
         Generate access token
         Set session cookie
         Return user profile data
      Else:
         Log failed attempt
         Return "Invalid credentials" error

2. File Processing Workflow:
   TransformImageFiles(sourceDir):
      Verify directory exists → else create
      Scan for image files (jpg/png/gif)
      
      For each found file:
          Open file handle
          Check dimensions → skip if too small
          Convert to webp format
          Compress quality to 80%
          Save to output directory
          Close handles
      
      Generate conversion report:
          Count successes/failures
          Calculate size reduction
      Return summary statistics

3. Background Task Scheduler:
   ManageCronJobs(config):
      Parse schedule from configuration
      Initialize task queue
      
      While scheduler running:
          Check pending jobs
          For each due job:
              Acquire execution lock
              Spawn worker process
              Monitor resource usage
              
              If job succeeds:
                  Update last_run time
                  Log completion
              Else:
                  Retry up to max_attempts
                  If final failure → alert
      
      On shutdown:
          Drain active jobs
          Wait for completions
          Close logging systems`,
    
    examples: [
        {
            user: `// Python data validation class
class DataValidator:
    MAX_RETRIES = 3
    TIMEOUT = 30  # seconds
    
    def __init__(self, schema):
        self.schema = schema
        self.retries = 0
        
    def validate(self, data):
        while self.retries < MAX_RETRIES:
            try:
                result = jsonschema.validate(
                    data, 
                    self.schema,
                    format_checker=jsonschema.FormatChecker()
                )
                return True
            except jsonschema.ValidationError as e:
                self.retries += 1
                logging.warning(f"Validation attempt {self.retries} failed")
            except jsonschema.SchemaError as e:
                raise PermanentError("Invalid schema configuration")
        
        raise ValidationFailed("Max retries exceeded")`,
            assistant: `DataValidator:
    Constants:
        MAX_RETRIES = 3
        TIMEOUT_SECONDS = 30
    
    Initialize with validation schema
    
    Validate input data:
        While under retry limit:
            Attempt schema validation
            If successful → return true
            
            Handle validation errors:
                Increment retry counter
                Log warning
            
            Handle schema errors:
                Throw permanent configuration error
        
        After max retries → throw validation failure`
        },
        {
            user: `// TypeScript React hook
function useAuth(apiClient) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const login = async (credentials) => {
        setLoading(true);
        try {
            const response = await apiClient.post('/auth', credentials);
            setUser(response.data.user);
            localStorage.setItem('token', response.data.token);
            return { success: true };
        } catch (error) {
            if (error.response?.status === 401) {
                return { error: 'Invalid credentials' };
            }
            return { error: 'Connection failed' };
        } finally {
            setLoading(false);
        }
    };
    
    return { user, loading, login };
}`,
            assistant: `Authentication Hook:
    Maintain user state and loading flag
    
    Login procedure:
        Set loading state
        Attempt API authentication:
            Send credentials to auth endpoint
            On success:
                Update user state
                Store access token
                Return success status
            
            Handle errors:
                If 401 status → invalid credentials
                Else → connection failure
            Clear loading state
        
        Return login controls`
        },
        {
            user: `// Go concurrent pipeline
func ProcessOrders(ctx context.Context, orders <-chan Order) <-chan Result {
    results := make(chan Result)
    var wg sync.WaitGroup
    
    for i := 0; i < 5; i++ {
        wg.Add(1)
        go func(workerID int) {
            defer wg.Done()
            for order := range orders {
                select {
                case <-ctx.Done():
                    return
                default:
                    res := validateOrder(order)
                    if res.Error != nil {
                        results <- res
                        continue
                    }
                    processed := enrichOrder(order)
                    results <- processPayment(processed)
                }
            }
        }(i)
    }
    
    go func() {
        wg.Wait()
        close(results)
    }()
    
    return results
}`,
            assistant: `Order Processing Pipeline:
    Create results channel
    Setup worker synchronization
    
    Launch 5 worker goroutines:
        Process orders until channel closed
        Validate each order:
            If invalid → send error result
            Else enrich order data
            Process payment → send result
        Handle cancellation signals
    
    Start cleanup goroutine:
        Wait for all workers
        Close results channel
    
    Return results stream`
        },
        {
            user: `// C# Entity Framework service
public class ProductService : IProductService
{
    private readonly AppDbContext _context;
    
    public ProductService(AppDbContext context)
    {
        _context = context;
    }
    
    public async Task UpdateInventory(int productId, int adjustment)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();
        
        try {
            var product = await _context.Products
                .FirstOrDefaultAsync(p => p.Id == productId);
            
            if (product == null)
                throw new ArgumentException("Product not found");
            
            product.Stock += adjustment;
            
            if (product.Stock < 0)
                throw new InvalidOperationException("Insufficient stock");
            
            await _context.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch {
            await transaction.RollbackAsync();
            throw;
        }
    }
}`,
            assistant: `Inventory Management Service:
    Initialize with database context
    
    Update product stock:
        Start database transaction
        Try:
            Find product by ID
            If missing → throw error
            
            Adjust stock level
            If stock negative → throw error
            
            Save changes
            Commit transaction
        
        Catch failures:
            Rollback transaction
            Re-throw error`
        },
        {
            user: `// Java Spring controller
@RestController
@RequestMapping("/api/users")
public class UserController {
    
    private final UserRepository userRepo;
    
    public UserController(UserRepository userRepo) {
        this.userRepo = userRepo;
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return userRepo.findById(id)
            .map(user -> ResponseEntity.ok(user))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
    
    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody UserDto dto) {
        if (userRepo.existsByEmail(dto.getEmail())) {
            throw new ConflictException("Email already exists");
        }
        
        User newUser = new User(dto.getName(), dto.getEmail());
        userRepo.save(newUser);
        return ResponseEntity.created(newUser.getId());
    }
}`,
            assistant: `User API Controller:
    Expose user endpoints at /api/users
    
    Get user by ID:
        Query database for ID
        If found → return 200 with user
        Else → return 404
    
    Create new user:
        Check for existing email
        If exists → throw conflict error
        
        Convert DTO to user entity
        Save to database
        Return 201 created response`
        }
    ]
};