import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GitPanel } from './git-panel';

describe('GitPanel', () => {
  let component: GitPanel;
  let fixture: ComponentFixture<GitPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GitPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GitPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
