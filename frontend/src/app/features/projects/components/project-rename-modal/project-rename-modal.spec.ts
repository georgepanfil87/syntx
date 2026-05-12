import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectRenameModal } from './project-rename-modal';

describe('ProjectRenameModal', () => {
  let component: ProjectRenameModal;
  let fixture: ComponentFixture<ProjectRenameModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectRenameModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectRenameModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
