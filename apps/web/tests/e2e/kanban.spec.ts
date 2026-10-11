import { test, expect, Page } from '@playwright/test';

// Helper to set up a clean project for each isolated test case
async function createProject(page: Page): Promise<string> {
  const newProjectBtn = page.locator('button:has-text("New Project")');
  await expect(newProjectBtn).toBeVisible();
  await newProjectBtn.click();

  const projectTitleInput = page.locator('input[placeholder*="Project title"]');
  await expect(projectTitleInput).toBeVisible();
  const projectTitle = `E2E Proj ${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await projectTitleInput.fill(projectTitle);
  await projectTitleInput.press('Enter');

  const projectLink = page.locator('a', { hasText: projectTitle });
  await expect(projectLink).toBeVisible();
  await projectLink.click();

  return projectTitle;
}

test.describe('Jotter Kanban E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/settings', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.language = 'en';
      await route.fulfill({ json });
    });
    await page.goto('/');
  });

  test('should display default columns upon project creation', async ({ page }) => {
    await createProject(page);

    await expect(page.locator('text=Backlog')).toBeVisible();
    await expect(page.locator('text=To Do')).toBeVisible();
    await expect(page.locator('text=In Progress')).toBeVisible();
    await expect(page.locator('text=Done')).toBeVisible();
  });

  test('should support task creation in To Do column', async ({ page }) => {
    await createProject(page);

    // Click "Add Task" button (in the top header bar)
    const addTaskBtn = page.locator('button:has-text("Add Task")').first();
    await expect(addTaskBtn).toBeVisible();
    await addTaskBtn.click();

    // The creation modal should open. Fill in title.
    const titleInput = page.locator('input[placeholder="What needs to be done?"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('E2E Test Task');

    // Click "Create Task" button to submit the form
    const createTaskSubmitBtn = page.locator('button:has-text("Create Task")').last();
    await expect(createTaskSubmitBtn).toBeVisible();
    await createTaskSubmitBtn.click();

    // Verify task card was created on the board
    const taskCard = page.locator('h4', { hasText: 'E2E Test Task' }).first();
    await expect(taskCard).toBeVisible();
  });

  test('should support editing task details', async ({ page }) => {
    await createProject(page);

    // Create a task first
    const addTaskBtn = page.locator('button:has-text("Add Task")').first();
    await addTaskBtn.click();
    const titleInput = page.locator('input[placeholder="What needs to be done?"]');
    await titleInput.fill('Original Task Title');
    const createTaskSubmitBtn = page.locator('button:has-text("Create Task")').last();
    await createTaskSubmitBtn.click();

    // Click on the task card to open the details modal
    const taskCard = page.locator('h4', { hasText: 'Original Task Title' }).first();
    await taskCard.click();

    // Click "Edit" button inside the details modal
    const editBtn = page.locator('button:has-text("Edit")');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Find the title input inside the edit view and change the title
    const editTitleInput = page.locator('input[placeholder="What needs to be done?"]');
    await expect(editTitleInput).toBeVisible();
    await editTitleInput.fill('Updated Task Title');

    // Click "Save Changes" button
    const saveChangesBtn = page.locator('button:has-text("Save Changes")');
    await expect(saveChangesBtn).toBeVisible();
    await saveChangesBtn.click();

    // Verify task card title is updated on the board
    const updatedTaskCard = page.locator('h4', { hasText: 'Updated Task Title' }).first();
    await expect(updatedTaskCard).toBeVisible();
    await expect(page.locator('h4', { hasText: 'Original Task Title' })).not.toBeVisible();
  });

  test('should support task deletion via the details modal', async ({ page }) => {
    await createProject(page);

    // Create a task first
    const addTaskBtn = page.locator('button:has-text("Add Task")').first();
    await addTaskBtn.click();
    const titleInput = page.locator('input[placeholder="What needs to be done?"]');
    await titleInput.fill('Task to Delete');
    const createTaskSubmitBtn = page.locator('button:has-text("Create Task")').last();
    await createTaskSubmitBtn.click();

    // Click on the task card to open details modal
    const taskCard = page.locator('h4', { hasText: 'Task to Delete' }).first();
    await taskCard.click();

    // Click "Delete" button inside the details modal
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Click the confirm button in the warning dialog popup
    const confirmDeleteBtn = page.locator('button.bg-amber-600');
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // Verify task card is completely deleted from the board
    await expect(page.locator('h4', { hasText: 'Task to Delete' })).not.toBeVisible();
  });
});
