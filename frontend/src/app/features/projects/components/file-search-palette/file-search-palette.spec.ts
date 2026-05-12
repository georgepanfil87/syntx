import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileSearchPalette } from './file-search-palette';

describe('FileSearchPalette', () => {
  let component: FileSearchPalette;
  let fixture: ComponentFixture<FileSearchPalette>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileSearchPalette]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileSearchPalette);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
