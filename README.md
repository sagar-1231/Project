# Aaru's Kitchen (HTML, CSS, JS + free Supabase database)

Koi server ya Node nahi chahiye. Menu, rate aur orders Supabase mein rehte hain, isliye admin ka badlav sabhi phones par turant dikhta hai.

## 1. Supabase (free)
1. supabase.com par naya project banayein.
2. **Authentication > Sign In / Providers > Email**: "Allow new users to sign up" ko **band (off)** karein. Ye zaroori hai.
3. **Authentication > Users > Add user**: apna email aur password daalein, "Auto Confirm User" ka tick lagayein. Isi se admin login hoga.
4. **SQL Editor**: `setup.sql` kholein, `CHANGE_ME@example.com` ki jagah apna wahi admin email likhein, poora paste karke **Run** dabayein.
5. **Project Settings > API**: **Project URL** aur **anon public** key copy karein. (`service_role` key kabhi yahan na daalein.)

## 2. Config
`config.js` mein `supabaseUrl` aur `supabaseAnonKey` bharein.

## 3. Internet par daalein
Poora folder GitHub Pages, Netlify ya Cloudflare Pages par daalein. Wahi link QR ban jayega.

## 4. Pehli baar
Page ke neeche **Admin** > email aur password > **Settings** mein dukaan ka WhatsApp number likhein. Menu, rate aur timing bhi wahin se badlein.

Dhyan: free Supabase project 1 hafte tak koi na aaye to pause ho jata hai. Dashboard se resume kar sakte hain.
