import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectWorkspace } from './project-workspace';

describe('ProjectWorkspace', () => {
  let component: ProjectWorkspace;
  let fixture: ComponentFixture<ProjectWorkspace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectWorkspace]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectWorkspace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
