# How to Test Offline Mode - Complete Guide

## Important: You Must Actually Go Offline!

The previous test failed because you were **ONLINE** when you tried to save the implant report. The console showed: `apiRequest called: POST /api/implant-procedures Online: true`

## Step-by-Step Testing Instructions

### Step 1: First Load (While Online)
1. **Open the app** in your browser
2. **Navigate through all pages** to cache data:
   - Dashboard (/)
   - Home Inventory (/inventory/home)
   - Car Inventory (/inventory/car)
   - Products (/products)
   - Hospitals (/hospitals)
   - Reports (/reports)
3. **Open DevTools** (Press F12)
4. **Go to Console tab** and verify you see messages like:
   - "Cached user for offline use: your@email.com"
   - "Cached 43 products for offline use"
   - "Offline data preloaded successfully"

### Step 2: Go OFFLINE
1. **Keep DevTools open** (F12)
2. **Go to the Network tab** (next to Console)
3. **Check the "Offline" checkbox** in the Network tab toolbar
   - You should see it near throttling options (Fast 3G, Slow 3G, etc.)
4. **Verify offline status**: 
   - The OfflineIndicator should turn RED
   - It should say "Offline" or "Offline (X pending)"

### Step 3: Test Creating an Implant Report Offline
1. **Still offline**, navigate to Reports page
2. **Click "New Implant Report"**
3. **Fill in the form** (use any hospital, date, materials)
4. **Click Save**
5. **Watch the Console tab** for messages with 🔴 or ✅:
   - You should see: "🔴 OFFLINE: Queueing mutation..."
   - Then: "✅ Mutation queued successfully..."
   - The OfflineIndicator should show "Offline (1 pending)"

### Step 4: Test Sync When Back Online
1. **Uncheck the "Offline" checkbox** in Network tab
2. **Watch the Console** - you should see:
   - "✅ ONLINE: Processing sync queue..."
   - "✅ Synced mutation X of Y..."
   - "✅ All pending changes synced successfully"
3. **The OfflineIndicator** should turn GREEN and show "Online"
4. **Refresh the Reports page** - your new report should appear!

## Common Issues

### "I'm offline but nothing is cached"
- Make sure you navigated through all pages while ONLINE first
- Check Console for "Cached X items for offline use" messages

### "The save button doesn't work offline"
- Check DevTools Console for error messages
- Look for 🔴 messages showing the mutation is being queued
- Verify the OfflineIndicator shows "Offline (X pending)"

### "My data didn't sync when I went back online"
- Check Console for sync error messages
- Try manually refreshing the page
- Check the OfflineIndicator - if it still shows pending items, there might be a sync error

## What Works Offline

✅ **Viewing** all cached data:
- Inventory (home & car)
- Products
- Hospitals
- Procedures

✅ **Creating** new items:
- Implant reports
- Inventory items

✅ **Editing** existing items:
- Any cached data

✅ **Deleting** items:
- Any cached data

All changes are **queued** and **automatically synced** when you go back online!

## PWA Installation Note

The Service Worker (for offline asset caching) does **NOT** work in development mode. It only works when the app is published/deployed. However, the data caching and sync queue work perfectly in dev mode for testing!
