const crypto = require('crypto');
require('dotenv').config();
const supabaseAdmin = require('./src/config/supabaseAdmin');

async function calculateCustomerProgramsProgress(tenantId, customerId) {
  const [
    { data: programs, error: programError },
    { data: stamps, error: stampError },
    { data: rewards, error: rewardError },
    { data: redemptions, error: redemptionError }
  ] = await Promise.all([
    supabaseAdmin
      .from('loyalty_programs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('stamps')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('redemptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
  ]);

  if (programError) throw programError;
  if (stampError) throw stampError;
  if (rewardError) throw rewardError;
  if (redemptionError) throw redemptionError;

  const now = new Date();
  const allStamps = stamps || [];
  const allRewards = rewards || [];
  const allRedemptions = redemptions || [];

  const programResults = [];

  for (const program of programs || []) {
    const stampsRequired = Number(program.stamps_required) || 10;
    const startDate = program.start_date ? new Date(program.start_date) : null;
    const endDate = program.end_date ? new Date(program.end_date) : null;

    const isExpired = endDate ? now > endDate : false;
    const isStarted = startDate ? now >= startDate : true;
    const isActive = program.is_active !== false && isStarted && !isExpired;

    const validStamps = allStamps.filter((s) => {
      if (s.loyalty_program_id && s.loyalty_program_id === program.id) return true;
      const stampDate = new Date(s.created_at);
      if (startDate && stampDate < startDate) return false;
      if (endDate && stampDate > endDate) return false;
      return true;
    });

    const programRewards = allRewards.filter((r) => r.loyalty_program_id === program.id);
    let consumedStamps = 0;
    if (programRewards.length > 0) {
      const rewardIds = new Set(programRewards.map((r) => r.id));
      const rewardMap = new Map(programRewards.map((r) => [r.id, Number(r.stamps_required) || stampsRequired]));
      for (const rdm of allRedemptions) {
        if (rewardIds.has(rdm.reward_id)) {
          consumedStamps += (rewardMap.get(rdm.reward_id) || stampsRequired);
        }
      }
    } else {
      for (const rdm of allRedemptions) {
        const matchingReward = allRewards.find((r) => r.id === rdm.reward_id);
        const req = matchingReward ? Number(matchingReward.stamps_required) : stampsRequired;
        if (req === stampsRequired) consumedStamps += req;
      }
    }

    const totalValidStamps = validStamps.length;
    const currentProgress = Math.max(0, totalValidStamps - consumedStamps);
    const remainingVisits = Math.max(0, stampsRequired - currentProgress);
    const rewardUnlocked = currentProgress >= stampsRequired;

    const matchingReward = programRewards[0] || allRewards.find(r => Number(r.stamps_required) === stampsRequired);
    const rewardTitle = matchingReward?.name || program.reward_description || program.name || 'Reward';
    const rewardDescription = matchingReward?.description || program.reward_description || '';

    programResults.push({
      id: program.id,
      tenant_id: program.tenant_id,
      name: program.name,
      stamps_required: stampsRequired,
      reward_description: rewardDescription,
      reward_title: rewardTitle,
      is_active: isActive,
      is_expired: isExpired,
      start_date: program.start_date || null,
      end_date: program.end_date || null,
      total_stamps: totalValidStamps,
      consumed_stamps: consumedStamps,
      current_stamps: currentProgress,
      current_progress: currentProgress,
      remaining_visits: remainingVisits,
      stamps_remaining: remainingVisits,
      reward_unlocked: rewardUnlocked,
      created_at: program.created_at,
      updated_at: program.updated_at
    });
  }

  return {
    all_programs: programResults,
    active_programs: programResults.filter((p) => p.is_active),
    expired_programs: programResults.filter((p) => p.is_expired),
    stamps: allStamps,
    redemptions: allRedemptions,
    rewards: allRewards
  };
}

async function runTests() {
  console.log('=== PHASE 6 EMPIRICAL REGRESSION & INTEGRATION TESTS ===\n');

  let testCount = 0;
  let passCount = 0;

  function assert(condition, description) {
    testCount++;
    if (condition) {
      console.log(`[PASS] Test ${testCount}: ${description}`);
      passCount++;
    } else {
      console.error(`[FAIL] Test ${testCount}: ${description}`);
    }
  }

  // Get existing customer & staff from DB
  const { data: existingCustomer } = await supabaseAdmin.from('customers').select('*').limit(1).single();
  const { data: existingStaff } = await supabaseAdmin.from('staff').select('*').limit(1).single();

  const testTenantId = crypto.randomUUID();
  const testCustomerId = crypto.randomUUID();
  const testStaffId = existingStaff ? existingStaff.id : crypto.randomUUID();

  console.log(`Setting up test environment (Tenant ID: ${testTenantId})...`);

  await supabaseAdmin.from('tenants').insert({
    id: testTenantId,
    business_name: 'Phase 6 Test Business',
    status: 'active'
  });

  const profileId = existingCustomer ? existingCustomer.profile_id : crypto.randomUUID();

  const { error: custErr } = await supabaseAdmin.from('customers').insert({
    id: testCustomerId,
    tenant_id: testTenantId,
    profile_id: profileId,
    name: 'Test Customer',
    status: 'active'
  });

  if (custErr) console.error('Customer setup error:', custErr);

  // TEST 1: One active program with 0 visits
  const prog1Id = crypto.randomUUID();
  await supabaseAdmin.from('loyalty_programs').insert({
    id: prog1Id,
    tenant_id: testTenantId,
    name: 'Free Coffee Program',
    stamps_required: 10,
    reward_description: 'Free Coffee',
    is_active: true
  });

  let progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  let p1 = progData.active_programs.find(p => p.id === prog1Id);
  assert(p1 && p1.current_stamps === 0 && p1.remaining_visits === 10 && !p1.reward_unlocked, '0 visits -> 0/10 visits, 10 remaining visits');

  // TEST 2: 2 visits
  for (let i = 0; i < 2; i++) {
    const visitId = crypto.randomUUID();
    await supabaseAdmin.from('visits').insert({ id: visitId, tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId });
    const { error: stampErr } = await supabaseAdmin.from('stamps').insert({ tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId, visit_id: visitId });
    if (stampErr) console.error('Stamp insert error:', stampErr);
  }
  progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  p1 = progData.active_programs.find(p => p.id === prog1Id);
  assert(p1 && p1.current_stamps === 2 && p1.remaining_visits === 8, '2 visits -> 2/10 visits, 8 remaining visits');

  // TEST 3 & 4: 9 visits and 10 visits (Reward Unlocked)
  for (let i = 0; i < 7; i++) {
    const visitId = crypto.randomUUID();
    await supabaseAdmin.from('visits').insert({ id: visitId, tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId });
    await supabaseAdmin.from('stamps').insert({ tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId, visit_id: visitId });
  }
  progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  p1 = progData.active_programs.find(p => p.id === prog1Id);
  assert(p1 && p1.current_stamps === 9 && p1.remaining_visits === 1, '9 visits -> 9/10 visits, 1 remaining visit');

  // 10th visit
  const visit10Id = crypto.randomUUID();
  await supabaseAdmin.from('visits').insert({ id: visit10Id, tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId });
  await supabaseAdmin.from('stamps').insert({ tenant_id: testTenantId, customer_id: testCustomerId, staff_id: testStaffId, visit_id: visit10Id });
  progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  p1 = progData.active_programs.find(p => p.id === prog1Id);
  assert(p1 && p1.current_stamps === 10 && p1.remaining_visits === 0 && p1.reward_unlocked, '10 visits -> 10/10 visits, Reward Unlocked');

  // TEST 5: Multiple programs
  const prog2Id = crypto.randomUUID();
  await supabaseAdmin.from('loyalty_programs').insert({
    id: prog2Id,
    tenant_id: testTenantId,
    name: 'Special Offer Program',
    stamps_required: 15,
    reward_description: '20% Discount',
    is_active: true
  });
  progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  p1 = progData.active_programs.find(p => p.id === prog1Id);
  let p2 = progData.active_programs.find(p => p.id === prog2Id);
  assert(p1.current_stamps === 10 && p1.remaining_visits === 0 && p2.current_stamps === 10 && p2.remaining_visits === 5, 'Multiple programs: Program A 10/10 (0 remaining), Program B 10/15 (5 remaining)');

  // TEST 6: Expired program
  const pastDate = new Date(Date.now() - 86400000).toISOString();
  const progExpiredId = crypto.randomUUID();
  await supabaseAdmin.from('loyalty_programs').insert({
    id: progExpiredId,
    tenant_id: testTenantId,
    name: 'Expired Summer Special',
    stamps_required: 5,
    end_date: pastDate,
    is_active: true
  });
  progData = await calculateCustomerProgramsProgress(testTenantId, testCustomerId);
  const expP = progData.expired_programs.find(p => p.id === progExpiredId);
  const actP = progData.active_programs.find(p => p.id === progExpiredId);
  assert(Boolean(expP) && !actP, 'Expired program appears in expired_programs and NOT in active_programs');

  // TEST 8: Tenant Isolation
  const tenantBId = crypto.randomUUID();
  const tenantBProgData = await calculateCustomerProgramsProgress(tenantBId, testCustomerId);
  assert(tenantBProgData.all_programs.length === 0, 'Tenant A customer receives 0 programs from Tenant B');

  // CLEANUP
  console.log('\nCleaning up test records...');
  await supabaseAdmin.from('stamps').delete().eq('tenant_id', testTenantId);
  await supabaseAdmin.from('visits').delete().eq('tenant_id', testTenantId);
  await supabaseAdmin.from('loyalty_programs').delete().eq('tenant_id', testTenantId);
  await supabaseAdmin.from('customers').delete().eq('tenant_id', testTenantId);
  await supabaseAdmin.from('tenants').delete().eq('id', testTenantId);

  console.log(`\n=== RESULTS: ${passCount} / ${testCount} TESTS PASSED ===\n`);
  if (passCount === testCount) process.exit(0);
  else process.exit(1);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
