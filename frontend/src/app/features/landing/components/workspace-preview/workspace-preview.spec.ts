import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkspacePreview } from './workspace-preview';

describe('WorkspacePreview', () => {
  let component: WorkspacePreview;
  let fixture: ComponentFixture<WorkspacePreview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspacePreview]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WorkspacePreview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
