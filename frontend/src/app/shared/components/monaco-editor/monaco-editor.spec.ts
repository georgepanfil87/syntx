import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonacoEditor } from './monaco-editor';

describe('MonacoEditor', () => {
  let component: MonacoEditor;
  let fixture: ComponentFixture<MonacoEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonacoEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MonacoEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
