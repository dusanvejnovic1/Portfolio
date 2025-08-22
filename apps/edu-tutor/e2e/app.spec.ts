import { test, expect } from '@playwright/test'

test.describe('Portfolio AI App', () => {
  test('loads homepage and displays welcome message', async ({ page }) => {
    await page.goto('/')
    
    // Check that the page loads
  await expect(page).toHaveTitle(/Portfolio AI/)
    
    // Check for main heading
  await expect(page.getByText('Portfolio AI')).toBeVisible()
    
    // Check for welcome message in empty state
    await expect(page.getByText('Welcome to your AI tutor!')).toBeVisible()
    
    // Check for example prompts
    await expect(page.getByText('Try asking:')).toBeVisible()
    await expect(page.getByText('"Explain photosynthesis"')).toBeVisible()
  })

  test('can toggle hints mode', async ({ page }) => {
    await page.goto('/')
    
    // Find the hints mode toggle
    const hintsToggle = page.getByLabel('Hints mode')
    await expect(hintsToggle).toBeVisible()
    
    // It should be checked by default
    await expect(hintsToggle).toBeChecked()
    
    // Toggle it off
    await hintsToggle.click()
    await expect(hintsToggle).not.toBeChecked()
    
    // Toggle it back on
    await hintsToggle.click()
    await expect(hintsToggle).toBeChecked()
  })

  test('can toggle sidebar', async ({ page }) => {
    await page.goto('/')
    
    // Find sidebar toggle button
    const sidebarToggle = page.getByLabel('Open sidebar')
    await expect(sidebarToggle).toBeVisible()
    
    // Click to open sidebar
    await sidebarToggle.click()
    
    // Check if sidebar is visible
    await expect(page.getByText('Conversations')).toBeVisible()
    await expect(page.getByText('New Chat')).toBeVisible()
    
    // Close sidebar
    const closeSidebar = page.getByLabel('Close sidebar')
    await closeSidebar.click()
    
    // Sidebar should be closed
    await expect(page.getByText('Conversations')).not.toBeVisible()
  })

  test('displays image upload area', async ({ page }) => {
    await page.goto('/')
    
    // Check for image upload section
    await expect(page.getByText('Upload Image (Optional)')).toBeVisible()
    await expect(page.getByText('Click to upload')).toBeVisible()
    await expect(page.getByText('JPEG, PNG up to 500MB')).toBeVisible()
  })

  test('has accessible form elements', async ({ page }) => {
    await page.goto('/')
    
    // Check text input
    const textInput = page.getByLabel('Ask your educational question')
    await expect(textInput).toBeVisible()
    
    // Check send button
    const sendButton = page.getByRole('button', { name: 'Send' })
    await expect(sendButton).toBeVisible()
    await expect(sendButton).toBeDisabled() // Should be disabled when no input
    
    // Add some text and check if button becomes enabled
    await textInput.fill('What is photosynthesis?')
    await expect(sendButton).toBeEnabled()
  })

  test('navigation to about page works', async ({ page }) => {
    await page.goto('/')
    
    // Click about link
    await page.getByRole('link', { name: 'About' }).click()
    
    // Check we're on about page
    await expect(page).toHaveURL('/about')
  await expect(page.getByText('About Portfolio AI')).toBeVisible()
  })

  test('model selector is accessible', async ({ page }) => {
    // Test on desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/')
    
    // Model selector should be visible on desktop
    await expect(page.getByText('GPT-4 Mini')).toBeVisible()
  })

  test('responsive design works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Check that page loads properly on mobile
  await expect(page.getByText('Portfolio AI')).toBeVisible()
    await expect(page.getByText('Welcome to your AI tutor!')).toBeVisible()
    
    // Sidebar should be closed by default on mobile
    const sidebarToggle = page.getByLabel('Open sidebar')
    await expect(sidebarToggle).toBeVisible()
  })
})