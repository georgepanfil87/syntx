import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileTree } from './file-tree';

describe('FileTree', () => {
  let component: FileTree;
  let fixture: ComponentFixture<FileTree>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTree]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileTree);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
