import { DiffCalculator } from '../utils/diffCalculator';

function testDiffImplementations() {
    // Test cases
    const testCases = [
        {
            name: "Simple function change",
            oldCode: `function hello() {
    console.log("Hello");
}`,
            newCode: `function hello() {
    console.log("Hello, World!");
}`
        },
        {
            name: "Function with indentation",
            oldCode: `function processData(data) {
    if (!data) {
        throw new Error("No data");
    }
    return data.map(x => x * 2);
}`,
            newCode: `function processData(data) {
    if (!data || data.length === 0) {
        throw new Error("Invalid data");
    }
    const result = data.map(x => x * 2);
    return result.filter(x => x > 0);
}`
        }
    ];

    for (const test of testCases) {
        console.log(`\n=== Testing: ${test.name} ===`);
        
        // Generate diff with hunk headers
        const diff = DiffCalculator.calculateInternalDiff(test.oldCode, test.newCode);
        console.log('\nDiff output:');
        console.log(diff.join('\n'));

        // Test applying the diff
        const newCode = DiffCalculator.applyDiff(test.oldCode, diff.join('\n'));
        console.log('\nApplied diff result:');
        console.log(newCode);
        console.log('\nMatches expected:', newCode === test.newCode);
    }
}

testDiffImplementations(); 