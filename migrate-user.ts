import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function migrate() {
  const email = 'rafael@example.com' // Using a placeholder since I can't find the real one, but usually we would use the one from env if available
  const password = 'Picture1!'
  
  console.log(`Checking if user ${email} exists...`)
  
  // Try to find the user
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Error listing users:', listError)
    process.exit(1)
  }
  
  let user = users.find(u => u.email === email)
  
  if (!user) {
    console.log(`User ${email} not found, creating...`)
    const { data: { user: newUser }, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })
    
    if (createError) {
      console.error('Error creating user:', createError)
      process.exit(1)
    }
    user = newUser
    console.log(`User created with ID: ${user?.id}`)
  } else {
    console.log(`User ${email} already exists with ID: ${user.id}`)
  }
  
  if (user) {
    console.log(`Creating profile for user ID: ${user.id}`)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        nome: 'Rafael',
        email: user.email,
        role: 'admin',
        status: 'ativo'
      })
    
    if (profileError) {
      console.error('Error creating profile:', profileError)
      process.exit(1)
    }
    console.log('Profile created successfully.')
  }
}

migrate()
