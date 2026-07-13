import { test, expect } from '@playwright/test';

test.describe('Jotter Kanban E2E Flow', () => {
  test('should support creating a project and managing tasks', async ({ page }) => {
    // 1. Load the homepage
    await page.goto('/');

    // 2. Click "New Project" button in the sidebar to show the inline input field
    const newProjectBtn = page.locator('button:has-text("New Project")');
    await expect(newProjectBtn).toBeVisible();
    await newProjectBtn.click();

    // 3. Fill in the project title input and press Enter to submit inline
    const projectTitleInput = page.locator('input[placeholder*="Project title"]');
    await expect(projectTitleInput).toBeVisible();
    const projectTitle = `E2E Project ${Date.now()}`;
    await projectTitleInput.fill(projectTitle);
    await projectTitleInput.press('Enter');

    // 4. Click on the newly created project in the sidebar to navigate to it
    const projectLink = page.locator('a', { hasText: projectTitle });
    await expect(projectLink).toBeVisible();
    await projectLink.click();

    // 5. Verify that the project page renders the default columns
    await expect(page.locator('text=Backlog')).toBeVisible();
    await expect(page.locator('text=To Do')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Done')).toBeVisible();

    // 6. Click "Add Task" button (in the top header bar)
    const addTaskBtn = page.locator('button:has-text("Add Task")').first();
    await expect(addTaskBtn).toBeVisible();
    await addTaskBtn.click();

    // 7. The creation modal should open. Find the input and fill in a title.
    const titleInput = page.locator('input[placeholder="What needs to be done?"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('E2E Test Task');

    // 8. Click "Create Task" button to submit the form
    const createTaskSubmitBtn = page.locator('button:has-text("Create Task")').last();
    await expect(createTaskSubmitBtn).toBeVisible();
    await createTaskSubmitBtn.click();

    // 9. Verify task card was created on the board
    const taskCard = page.locator('h4', { hasText: 'E2E Test Task' }).first();
    await expect(taskCard).toBeVisible();
  });
});
