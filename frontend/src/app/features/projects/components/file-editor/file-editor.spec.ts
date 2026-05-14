import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileEditor } from './file-editor';

describe('FileEditor', () => {
  let component: FileEditor;
  let fixture: ComponentFixture<FileEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
