#!/usr/bin/env node

/**
 * Analyze Railway metrics from load test
 */

const data = {"data":{"metrics":[{"measurement":"CPU_USAGE","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962220,"value":0.000093},{"ts":1782962250,"value":0},{"ts":1782962280,"value":0.00010406666666666666},{"ts":1782962310,"value":0.000005333333333333333},{"ts":1782962340,"value":0.0000802},{"ts":1782962370,"value":0.000003},{"ts":1782962400,"value":0.0001296},{"ts":1782962430,"value":0.000006566666666666667},{"ts":1782962460,"value":0},{"ts":1782962490,"value":0.00007553333333333333},{"ts":1782962520,"value":0.00012396666666666668},{"ts":1782962550,"value":0.0000062},{"ts":1782962580,"value":0.00007259999999999999},{"ts":1782962610,"value":0.000028800000000000002},{"ts":1782962640,"value":0.00012523333333333333},{"ts":1782962670,"value":0.000006},{"ts":1782962700,"value":0.00010146666666666666},{"ts":1782962730,"value":0},{"ts":1782962760,"value":0.00007876666666666667},{"ts":1782962790,"value":0.0000054},{"ts":1782962820,"value":0.0001089},{"ts":1782962850,"value":0.000005666666666666667},{"ts":1782962880,"value":0},{"ts":1782962910,"value":0.0022487333333333333},{"ts":1782962940,"value":0.011797633333333333},{"ts":1782962970,"value":0.0000108},{"ts":1782963000,"value":0.00016863333333333333},{"ts":1782963030,"value":0},{"ts":1782963060,"value":0.00007486666666666667},{"ts":1782963090,"value":0.000005566666666666666},{"ts":1782963120,"value":0.10993193333333333},{"ts":1782963150,"value":0.29606706666666666},{"ts":1782963180,"value":0.3130391666666667},{"ts":1782963210,"value":0},{"ts":1782963240,"value":0.1342119},{"ts":1782963270,"value":0.0005486333333333334},{"ts":1782963300,"value":0.00017916666666666667},{"ts":1782963330,"value":0.000003466666666666667},{"ts":1782963360,"value":0},{"ts":1782963390,"value":0.00032203333333333337},{"ts":1782963420,"value":0.0003101666666666667},{"ts":1782963450,"value":0.000007066666666666666},{"ts":1782963480,"value":0.0006853333333333334},{"ts":1782963510,"value":0.0000069},{"ts":1782963540,"value":0},{"ts":1782963570,"value":0.00011740000000000001},{"ts":1782963600,"value":0.00013656666666666666},{"ts":1782963630,"value":0.0000035},{"ts":1782963660,"value":0.0001532333333333333},{"ts":1782963690,"value":0.0000067666666666666665},{"ts":1782963720,"value":0.0004655666666666667},{"ts":1782963750,"value":0},{"ts":1782963780,"value":0.00031536666666666667},{"ts":1782963810,"value":0.0008354333333333333},{"ts":1782963840,"value":0.0002678333333333333},{"ts":1782963870,"value":0.000007266666666666667},{"ts":1782963900,"value":0.0001644},{"ts":1782963930,"value":0},{"ts":1782963960,"value":0.0002568333333333333},{"ts":1782963990,"value":0.000006633333333333334},{"ts":1782964020,"value":0.0001583},{"ts":1782964050,"value":0.0000037666666666666665},{"ts":1782964080,"value":0.00013286666666666668},{"ts":1782964110,"value":0},{"ts":1782964140,"value":0.00020526666666666668},{"ts":1782964170,"value":0},{"ts":1782964200,"value":0.0002031},{"ts":1782964230,"value":0.0000061},{"ts":1782964260,"value":0.0004809},{"ts":1782964290,"value":0.0000035666666666666667},{"ts":1782964320,"value":0},{"ts":1782964350,"value":0.00013886666666666666},{"ts":1782964380,"value":0.00010376666666666666},{"ts":1782964410,"value":0.000007133333333333333},{"ts":1782964440,"value":0.00011323333333333334},{"ts":1782964470,"value":0},{"ts":1782964500,"value":0.00011963333333333335},{"ts":1782964530,"value":0.0000065},{"ts":1782964560,"value":0.00010559999999999999},{"ts":1782964590,"value":0.000007133333333333333},{"ts":1782964620,"value":0},{"ts":1782964650,"value":0.00013173333333333333},{"ts":1782964680,"value":0.00012636666666666666},{"ts":1782964710,"value":0.000006466666666666667},{"ts":1782964740,"value":0.0001601},{"ts":1782964770,"value":0.0000035},{"ts":1782964800,"value":0.000129},{"ts":1782964830,"value":0.0000068},{"ts":1782964860,"value":0},{"ts":1782964890,"value":0.00014606666666666668},{"ts":1782964920,"value":0.00013826666666666668},{"ts":1782964950,"value":0.000005933333333333334},{"ts":1782964980,"value":0.00021703333333333334},{"ts":1782965010,"value":0.000007599999999999999},{"ts":1782965040,"value":0},{"ts":1782965070,"value":0.0001022},{"ts":1782965100,"value":0.00013483333333333335},{"ts":1782965130,"value":0.000006266666666666666},{"ts":1782965160,"value":0.0001003},{"ts":1782965190,"value":0.0000033333333333333333},{"ts":1782965220,"value":0},{"ts":1782965250,"value":0.0005858333333333334},{"ts":1782965280,"value":0.00008956666666666666},{"ts":1782965310,"value":0.0000057999999999999995},{"ts":1782965340,"value":0.00013486666666666667},{"ts":1782965370,"value":0.0000031666666666666667},{"ts":1782965400,"value":0.00012053333333333333},{"ts":1782965430,"value":0},{"ts":1782965460,"value":0.00010076666666666667},{"ts":1782965490,"value":0.0000059},{"ts":1782965520,"value":0.00012546666666666666},{"ts":1782965550,"value":0.000007933333333333334},{"ts":1782965580,"value":0.00009663333333333334},{"ts":1782965610,"value":0.0000033333333333333333},{"ts":1782965640,"value":0.00013963333333333333},{"ts":1782965670,"value":0.000026666666666666667},{"ts":1782965700,"value":0.00011013333333333335},{"ts":1782965730,"value":0},{"ts":1782965760,"value":0.00016593333333333335},{"ts":1782965790,"value":0.0000064000000000000006},{"ts":1782965820,"value":0}]},{"measurement":"CPU_LIMIT","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962220,"value":8}]},{"measurement":"MEMORY_USAGE_GB","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962220,"value":0.094425088},{"ts":1782963120,"value":0.140337152},{"ts":1782963150,"value":0.143724544},{"ts":1782963180,"value":0.156086272},{"ts":1782963210,"value":0.156086272},{"ts":1782963240,"value":0.104669184}]},{"measurement":"MEMORY_LIMIT_GB","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962220,"value":8}]},{"measurement":"NETWORK_RX_GB","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962910,"value":0.000003992},{"ts":1782962940,"value":0.000027609},{"ts":1782963120,"value":0.000251606},{"ts":1782963150,"value":0.001397566},{"ts":1782963180,"value":0.001887774},{"ts":1782963240,"value":0.000870827},{"ts":1782963810,"value":8.63e-7},{"ts":1782963840,"value":9.29e-7}]},{"measurement":"NETWORK_TX_GB","tags":{"deploymentInstanceId":null,"deploymentId":null,"region":null},"values":[{"ts":1782962910,"value":0.000005135},{"ts":1782962940,"value":0.000045893},{"ts":1782963120,"value":0.00035},{"ts":1782963150,"value":0.001675245},{"ts":1782963180,"value":0.002314131},{"ts":1782963240,"value":0.001048942},{"ts":1782963810,"value":0.000001717},{"ts":1782963840,"value":0.000001717}]}]}};

const metrics = data.data.metrics;

// Find CPU usage metric
const cpuMetric = metrics.find(m => m.measurement === 'CPU_USAGE');
const memMetric = metrics.find(m => m.measurement === 'MEMORY_USAGE_GB');
const rxMetric = metrics.find(m => m.measurement === 'NETWORK_RX_GB');
const txMetric = metrics.find(m => m.measurement === 'NETWORK_TX_GB');

console.log('\n🔥 LOAD TEST ANALYSIS - Railway Metrics\n');
console.log('═'.repeat(80));

// Find peak activity
const peakCPU = cpuMetric.values.reduce((max, v) => v.value > max.value ? v : max);
const peakMem = memMetric.values.reduce((max, v) => v.value > max.value ? v : max);

console.log('\n📊 PEAK RESOURCE USAGE:');
console.log(`  CPU:    ${(peakCPU.value * 100).toFixed(2)}% (at ${new Date(peakCPU.ts * 1000).toISOString()})`);
console.log(`  Memory: ${(peakMem.value * 1024).toFixed(0)} MB (at ${new Date(peakMem.ts * 1000).toISOString()})`);

// Network analysis
const totalRx = rxMetric.values.reduce((sum, v) => sum + v.value, 0);
const totalTx = txMetric.values.reduce((sum, v) => sum + v.value, 0);

console.log('\n📡 NETWORK TRAFFIC:');
console.log(`  Received: ${(totalRx * 1024).toFixed(2)} MB`);
console.log(`  Sent:     ${(totalTx * 1024).toFixed(2)} MB`);

// Identify load test window
console.log('\n⏰ LOAD TEST TIMELINE:');
const highCPU = cpuMetric.values.filter(v => v.value > 0.01);
highCPU.forEach(v => {
  const time = new Date(v.ts * 1000);
  console.log(`  ${time.toISOString()} - CPU: ${(v.value * 100).toFixed(2)}%`);
});

console.log('\n' + '═'.repeat(80));
