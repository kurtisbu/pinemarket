import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TEST_EMAIL_DOMAIN = 'pinemarket-test.com'
const TEST_PASSWORD = 'TestPass123!'

const SELLERS = [
  { email: `test-seller-1@${TEST_EMAIL_DOMAIN}`, displayName: 'Alpha Trading Co', username: 'alpha_trading', bio: 'Professional trading indicators and strategies.' },
  { email: `test-seller-2@${TEST_EMAIL_DOMAIN}`, displayName: 'QuantEdge Systems', username: 'quantedge', bio: 'Quantitative trading solutions for retail traders.' },
  { email: `test-seller-3@${TEST_EMAIL_DOMAIN}`, displayName: 'PineScript Labs', username: 'pinescript_labs', bio: 'Open-source inspired tools for TradingView.' },
]

const BUYERS = [
  { email: `test-buyer-1@${TEST_EMAIL_DOMAIN}`, displayName: 'Demo Trader 1', username: 'demo_trader_1', tvUsername: 'test_buyer_tv_1' },
  { email: `test-buyer-2@${TEST_EMAIL_DOMAIN}`, displayName: 'Demo Trader 2', username: 'demo_trader_2', tvUsername: 'test_buyer_tv_2' },
  { email: `test-buyer-3@${TEST_EMAIL_DOMAIN}`, displayName: 'Demo Trader 3', username: 'demo_trader_3', tvUsername: 'test_buyer_tv_3' },
]

interface ProgramDef {
  sellerIndex: number
  title: string
  category: string
  description: string
  tags: string[]
  pricingModel: string
  price: number
  monthlyPrice: number | null
  yearlyPrice: number | null
  trialDays: number
  scriptIndices: number[] // indices into the scripts array
}

const PROGRAMS: ProgramDef[] = [
  {
    sellerIndex: 0, title: 'SuperTrend Pro Suite', category: 'indicator',
    description: 'Advanced SuperTrend indicator with multi-timeframe analysis, custom alerts, and divergence detection. Perfect for swing traders looking for reliable trend signals.',
    tags: ['supertrend', 'trend-following', 'alerts', 'mtf'],
    pricingModel: 'one_time', price: 49.99, monthlyPrice: null, yearlyPrice: null, trialDays: 0,
    scriptIndices: [0, 6],
  },
  {
    sellerIndex: 0, title: 'EMA Crossover Strategy Pack', category: 'strategy',
    description: 'Complete EMA crossover strategy with backtesting, risk management, and automated alerts. Includes monthly and yearly subscription options with a 7-day free trial.',
    tags: ['ema', 'crossover', 'strategy', 'backtesting'],
    pricingModel: 'subscription', price: 0, monthlyPrice: 19.99, yearlyPrice: 149.99, trialDays: 7,
    scriptIndices: [7, 13],
  },
  {
    sellerIndex: 0, title: 'Volume Delta Analysis', category: 'strategy',
    description: 'Professional volume analysis toolkit featuring cumulative volume delta with divergence detection. One-time purchase plus optional monthly subscription.',
    tags: ['volume', 'delta', 'divergence', 'analysis'],
    pricingModel: 'one_time', price: 99, monthlyPrice: 29.99, yearlyPrice: null, trialDays: 0,
    scriptIndices: [1, 10],
  },
  {
    sellerIndex: 1, title: 'Fibonacci Bollinger Suite', category: 'indicator',
    description: 'Combines Fibonacci retracements with Bollinger Bands for precise entry and exit signals. Includes a 3-day trial to test the indicator.',
    tags: ['fibonacci', 'bollinger', 'bands', 'precision'],
    pricingModel: 'one_time', price: 29.99, monthlyPrice: null, yearlyPrice: null, trialDays: 3,
    scriptIndices: [12, 19],
  },
  {
    sellerIndex: 1, title: 'VWAP Oscillator Toolkit', category: 'utility',
    description: 'VWAP-based oscillator for intraday trading with envelope calculations and signal generation. Monthly subscription model.',
    tags: ['vwap', 'oscillator', 'intraday', 'signals'],
    pricingModel: 'subscription', price: 0, monthlyPrice: 9.99, yearlyPrice: null, trialDays: 0,
    scriptIndices: [18],
  },
  {
    sellerIndex: 1, title: 'Multi-Timeframe Impulse Zones', category: 'strategy',
    description: 'Identify high-probability impulse zones across multiple timeframes. Yearly subscription with a generous 14-day trial period.',
    tags: ['mtf', 'impulse', 'zones', 'swing-trading'],
    pricingModel: 'subscription', price: 0, monthlyPrice: null, yearlyPrice: 199.99, trialDays: 14,
    scriptIndices: [11, 17],
  },
  {
    sellerIndex: 2, title: 'HuntMaster PRO Bundle', category: 'indicator',
    description: 'Premium hunting indicator suite for identifying institutional order flow and liquidity zones. One-time premium purchase.',
    tags: ['order-flow', 'liquidity', 'institutional', 'premium'],
    pricingModel: 'one_time', price: 149.99, monthlyPrice: null, yearlyPrice: null, trialDays: 0,
    scriptIndices: [21, 22],
  },
  {
    sellerIndex: 2, title: 'MACD + RSI Strategy Combo', category: 'strategy',
    description: 'Combined MACD and RSI strategy with optimized parameters for crypto and forex markets. Monthly and yearly subscriptions with 7-day trial.',
    tags: ['macd', 'rsi', 'combo', 'crypto', 'forex'],
    pricingModel: 'subscription', price: 0, monthlyPrice: 39.99, yearlyPrice: 299.99, trialDays: 7,
    scriptIndices: [14, 16],
  },
  {
    sellerIndex: 2, title: 'Momentum Bars Indicator', category: 'utility',
    description: 'Visual momentum indicator using color-coded bars to identify trend strength and reversals. Affordable one-time purchase.',
    tags: ['momentum', 'bars', 'visual', 'trend'],
    pricingModel: 'one_time', price: 19.99, monthlyPrice: null, yearlyPrice: null, trialDays: 0,
    scriptIndices: [22],
  },
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: claims, error: claimsErr } = await supabaseUser.auth.getClaims(token)
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claims.claims.sub as string

    // Check admin
    const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { action } = await req.json()

    if (action === 'seed') {
      return await handleSeed(supabaseAdmin, userId)
    } else if (action === 'cleanup') {
      return await handleCleanup(supabaseAdmin)
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action. Use "seed" or "cleanup".' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (err: any) {
    console.error('seed-test-data error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function handleSeed(supabaseAdmin: any, adminUserId: string) {
  // 1. Fetch admin's real TV credentials
  const { data: adminProfile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('tradingview_username, tradingview_session_cookie, tradingview_signed_session_cookie, tradingview_last_validated_at')
    .eq('id', adminUserId)
    .single()

  if (profileErr || !adminProfile) {
    return jsonResponse({ error: 'Could not fetch admin profile', details: profileErr?.message }, 500)
  }

  // 2. Fetch admin's synced scripts
  const { data: scripts, error: scriptsErr } = await supabaseAdmin
    .from('tradingview_scripts')
    .select('id, title, script_id, pine_id')
    .eq('user_id', adminUserId)
    .order('created_at')

  if (scriptsErr || !scripts?.length) {
    return jsonResponse({ error: 'No TradingView scripts found', details: scriptsErr?.message }, 500)
  }

  // 3. Check if test data already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const existingTestEmails = existingUsers?.users
    ?.filter((u: any) => u.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`))
    .map((u: any) => u.email) || []

  if (existingTestEmails.length > 0) {
    return jsonResponse({ error: 'Test data already exists. Run cleanup first.', existingEmails: existingTestEmails }, 409)
  }

  const createdSellers: any[] = []
  const createdBuyers: any[] = []
  const createdPrograms: any[] = []

  // 4. Create seller accounts
  for (const seller of SELLERS) {
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: seller.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (authErr) {
      console.error(`Failed to create seller ${seller.email}:`, authErr)
      continue
    }

    // Update profile with TV credentials and seller info
    const { error: profileUpdateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: seller.displayName,
        username: seller.username,
        bio: seller.bio,
        role: 'seller',
        is_tradingview_connected: true,
        tradingview_connection_status: 'active',
        tradingview_username: adminProfile.tradingview_username,
        tradingview_session_cookie: adminProfile.tradingview_session_cookie,
        tradingview_signed_session_cookie: adminProfile.tradingview_signed_session_cookie,
        tradingview_last_validated_at: adminProfile.tradingview_last_validated_at,
      })
      .eq('id', authUser.user.id)

    if (profileUpdateErr) {
      console.error(`Failed to update seller profile ${seller.email}:`, profileUpdateErr)
    }

    createdSellers.push({ id: authUser.user.id, email: seller.email, displayName: seller.displayName })
  }

  // 5. Create buyer accounts
  for (const buyer of BUYERS) {
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: buyer.email,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    if (authErr) {
      console.error(`Failed to create buyer ${buyer.email}:`, authErr)
      continue
    }

    const { error: profileUpdateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        display_name: buyer.displayName,
        username: buyer.username,
        tradingview_username: buyer.tvUsername,
      })
      .eq('id', authUser.user.id)

    if (profileUpdateErr) {
      console.error(`Failed to update buyer profile ${buyer.email}:`, profileUpdateErr)
    }

    createdBuyers.push({ id: authUser.user.id, email: buyer.email, displayName: buyer.displayName })
  }

  // 6. Create programs and prices
  for (const progDef of PROGRAMS) {
    const seller = createdSellers[progDef.sellerIndex]
    if (!seller) continue

    const billingInterval = progDef.monthlyPrice && progDef.yearlyPrice ? 'both'
      : progDef.monthlyPrice ? 'monthly'
      : progDef.yearlyPrice ? 'yearly'
      : null

    const { data: program, error: progErr } = await supabaseAdmin
      .from('programs')
      .insert({
        seller_id: seller.id,
        title: progDef.title,
        category: progDef.category,
        description: progDef.description,
        tags: progDef.tags,
        pricing_model: progDef.pricingModel,
        price: progDef.pricingModel === 'one_time' ? progDef.price : (progDef.monthlyPrice || progDef.yearlyPrice || 0),
        monthly_price: progDef.monthlyPrice,
        yearly_price: progDef.yearlyPrice,
        billing_interval: billingInterval,
        trial_period_days: progDef.trialDays,
        status: 'draft',
      })
      .select('id, title')
      .single()

    if (progErr || !program) {
      console.error(`Failed to create program ${progDef.title}:`, progErr)
      continue
    }

    // Create program_prices
    const prices: any[] = []
    if (progDef.price > 0 && progDef.pricingModel === 'one_time') {
      prices.push({
        program_id: program.id,
        price_type: 'one_time',
        display_name: 'One-time Purchase',
        amount: progDef.price,
        sort_order: 0,
      })
    }
    if (progDef.monthlyPrice) {
      prices.push({
        program_id: program.id,
        price_type: 'recurring',
        interval: 'month',
        display_name: 'Monthly Subscription',
        amount: progDef.monthlyPrice,
        sort_order: prices.length,
      })
    }
    if (progDef.yearlyPrice) {
      prices.push({
        program_id: program.id,
        price_type: 'recurring',
        interval: 'year',
        display_name: 'Yearly Subscription',
        amount: progDef.yearlyPrice,
        sort_order: prices.length,
      })
    }
    // For programs with both one_time price AND monthly
    if (progDef.pricingModel === 'one_time' && progDef.monthlyPrice) {
      // already handled above
    }

    if (prices.length > 0) {
      const { error: priceErr } = await supabaseAdmin.from('program_prices').insert(prices)
      if (priceErr) console.error(`Failed to create prices for ${progDef.title}:`, priceErr)
    }

    // Create program_scripts linking to real scripts
    const scriptLinks: any[] = []
    for (let i = 0; i < progDef.scriptIndices.length; i++) {
      const scriptIdx = progDef.scriptIndices[i]
      if (scriptIdx < scripts.length) {
        scriptLinks.push({
          program_id: program.id,
          tradingview_script_id: scripts[scriptIdx].id,
          display_order: i,
        })
      }
    }

    if (scriptLinks.length > 0) {
      const { error: linkErr } = await supabaseAdmin.from('program_scripts').insert(scriptLinks)
      if (linkErr) console.error(`Failed to link scripts for ${progDef.title}:`, linkErr)
    }

    createdPrograms.push({
      id: program.id,
      title: program.title,
      seller: seller.displayName,
      category: progDef.category,
      pricing: progDef.pricingModel,
      price: progDef.price,
      monthlyPrice: progDef.monthlyPrice,
      yearlyPrice: progDef.yearlyPrice,
      trialDays: progDef.trialDays,
      linkedScripts: scriptLinks.map(l => scripts[progDef.scriptIndices[scriptLinks.indexOf(l)]]?.title).filter(Boolean),
    })
  }

  return jsonResponse({
    success: true,
    summary: {
      sellersCreated: createdSellers.length,
      buyersCreated: createdBuyers.length,
      programsCreated: createdPrograms.length,
    },
    sellers: createdSellers,
    buyers: createdBuyers,
    programs: createdPrograms,
    credentials: {
      password: TEST_PASSWORD,
      note: 'All test accounts use this password',
    },
  })
}

async function handleCleanup(supabaseAdmin: any) {
  // Find all test users
  const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers()
  const testUsers = allUsers?.users?.filter((u: any) => u.email?.endsWith(`@${TEST_EMAIL_DOMAIN}`)) || []
  const testUserIds = testUsers.map((u: any) => u.id)

  if (testUserIds.length === 0) {
    return jsonResponse({ success: true, message: 'No test data found to clean up.', counts: {} })
  }

  // Delete program_scripts for test user programs
  const { data: testPrograms } = await supabaseAdmin
    .from('programs')
    .select('id')
    .in('seller_id', testUserIds)

  const testProgramIds = testPrograms?.map((p: any) => p.id) || []

  let deletedScriptLinks = 0, deletedPrices = 0, deletedPrograms = 0, deletedUsers = 0

  if (testProgramIds.length > 0) {
    const { count: c1 } = await supabaseAdmin.from('program_scripts').delete({ count: 'exact' }).in('program_id', testProgramIds)
    deletedScriptLinks = c1 || 0

    const { count: c2 } = await supabaseAdmin.from('program_prices').delete({ count: 'exact' }).in('program_id', testProgramIds)
    deletedPrices = c2 || 0

    const { count: c3 } = await supabaseAdmin.from('programs').delete({ count: 'exact' }).in('seller_id', testUserIds)
    deletedPrograms = c3 || 0
  }

  // Delete auth users (profiles cascade or get deleted via trigger)
  for (const user of testUsers) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error(`Failed to delete user ${user.email}:`, error)
    } else {
      deletedUsers++
    }
  }

  return jsonResponse({
    success: true,
    message: 'Test data cleaned up successfully.',
    counts: {
      deletedUsers,
      deletedPrograms,
      deletedPrices,
      deletedScriptLinks,
    },
  })
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
